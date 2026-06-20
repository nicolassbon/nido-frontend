import { CommonModule } from '@angular/common';
import { Component, inject, Output, EventEmitter, Input, signal, OnInit, OnDestroy } from '@angular/core';
import { switchMap, of, Subject, debounceTime, distinctUntilChanged, takeUntil, map, catchError } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductService, SearchProductoResponse } from '../../core/servicios/agregar-producto.service';
import { AlacenaApiService, StockItemResponse } from '../alacena/alacena-api.service';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ListaComprasService } from '../lista-compras/lista-compras.service';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';
import { EstimatedDateNoticeComponent } from '../../shared/ui/estimated-date-notice/estimated-date-notice';
import { validatePhotoFile } from '../../shared/validators/photo';

/** Producto conocido para autocompletar (proviene de la alacena ya cargada) */
export interface KnownProduct {
  nombre:          string;
  categoriaNombre?: string;
  unidadMedida?:   string;
  ubicacion?:      string;
  stockId?:        string;   // id del stock_hogar si ya está en la alacena
  cantidad?:       number;   // cantidad POR envase
  cantidadEnvases?: number;  // número de envases del mismo producto
}

@Component({
  selector: 'app-agregar-producto',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule, NidoSelectComponent, NidoDatepickerComponent, EstimatedDateNoticeComponent],
  templateUrl: './agregar-producto.html',
  styleUrl: './agregar-producto.scss',
})
export class AgregarProducto implements OnInit, OnDestroy {
  /** Cuando se pasa, el form opera en modo edición (PATCH) */
  @Input() stockItem?: StockItemResponse;

  /** Productos ya conocidos (de la alacena) para sugerir al escribir el nombre */
  @Input() knownProducts: KnownProduct[] = [];

  @Input() isModal = false;
  @Output() closed = new EventEmitter<StockItemResponse | void>();

  private readonly fb                  = inject(FormBuilder);
  private readonly productService      = inject(ProductService);
  private readonly alacenaApi          = inject(AlacenaApiService);
  private readonly router              = inject(Router);
  private readonly authService         = inject(AuthService);
  private readonly listaComprasService = inject(ListaComprasService);

  protected isSaving     = false;
  protected errorMessage = '';
  protected warningMessage = '';
  protected selectedImage = signal<File | null>(null);
  protected imageError = signal<string | null>(null);

  protected isOpened    = signal(false);
  protected consumedPct = signal(0);

  // ── Autocomplete ──────────────────────────────────────────
  protected suggestions     = signal<KnownProduct[]>([]);
  protected showSuggestions = signal(false);
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$     = new Subject<void>();

  protected get isEditMode(): boolean { return !!this.stockItem; }

  // ── Opciones ──────────────────────────────────────────────
  protected readonly categoriasOpts: NidoSelectOption[] = [
    { value: '33333333-3333-3333-3333-333333333333', label: 'General' },
    { value: '44444444-4444-4444-4444-444444444444', label: 'Lácteos' },
    { value: '55555555-5555-5555-5555-555555555555', label: 'Bebidas' },
    { value: '66666666-6666-6666-6666-666666666666', label: 'Congelados' },
    { value: '77777777-7777-7777-7777-777777777777', label: 'Despensa' },
  ];

  protected readonly unidadesOpts: NidoSelectOption[] = [
    { value: 'unidad', label: 'Unidad' },
    { value: 'gr',     label: 'Gramos (gr)' },
    { value: 'kg',     label: 'Kilogramos (kg)' },
    { value: 'ml',     label: 'Mililitros (ml)' },
    { value: 'lt',     label: 'Litros (lt)' },
    { value: 'cdita',  label: 'Cucharadita' },
    { value: 'cda',    label: 'Cucharada' },
  ];

  protected readonly ubicaciones = ['Alacena', 'Freezer', 'Heladera'] as const;

  private readonly locationIcons: Record<string, string> = {
    Alacena:  'tag',
    Freezer:  'snowflake',
    Heladera: 'refrigerator',
  };

  private readonly locationColors: Record<string, string> = {
    Alacena:  '#B48B6A',
    Freezer:  '#3E5E4A',
    Heladera: '#927357',
  };

  getLocationIcon(loc: string): string  { return this.locationIcons[loc]  ?? 'package'; }
  getLocationColor(loc: string): string { return this.locationColors[loc] ?? '#263F30'; }

  /**
   * Combina los resultados del back con los productos ya cargados en la
   * alacena. Si un producto del back coincide con uno local, hereda
   * stockId/cantidad/unidad/ubicación del local (más actualizado).
   */
  private mergeSuggestions(results: SearchProductoResponse[]): KnownProduct[] {
    const localByName = new Map<string, KnownProduct>();
    for (const local of this.knownProducts) {
      localByName.set(local.nombre.trim().toLowerCase(), local);
    }

    const seen   = new Set<string>();
    const merged: KnownProduct[] = [];

    for (const r of results) {
      const key = r.nombre.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const local = localByName.get(key);
      merged.push({
        nombre:           r.nombre,
        categoriaNombre:  r.categoriaNombre ?? local?.categoriaNombre,
        unidadMedida:     local?.unidadMedida ?? r.unidadMedida ?? undefined,
        ubicacion:        local?.ubicacion    ?? r.ubicacion    ?? undefined,
        stockId:          local?.stockId,
        cantidad:         local?.cantidad,
        cantidadEnvases:  local?.cantidadEnvases,
      });
    }

    return merged.slice(0, 6);
  }

  private normalizeUnit(value: string | null | undefined): string {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const aliases: Record<string, string> = {
      '': 'unidad',
      u: 'unidad',
      unidad: 'unidad',
      unidades: 'unidad',
      unit: 'unidad',
      gr: 'gr',
      g: 'gr',
      gramo: 'gr',
      gramos: 'gr',
      kg: 'kg',
      kilo: 'kg',
      kilos: 'kg',
      kilogramo: 'kg',
      kilogramos: 'kg',
      ml: 'ml',
      mililitro: 'ml',
      mililitros: 'ml',
      lt: 'lt',
      l: 'lt',
      litro: 'lt',
      litros: 'lt',
      cdita: 'cdita',
      cucharadita: 'cdita',
      cucharaditas: 'cdita',
      cdta: 'cdita',
      cda: 'cda',
      cucharada: 'cda',
      cucharadas: 'cda',
    };

    return aliases[normalized] ?? normalized;
  }

  // ── Reactive form ─────────────────────────────────────────
  form = this.fb.group({
    nombre:           ['', Validators.required],
    categoriaId:      ['', Validators.required],
    ubicacion:        ['Alacena', Validators.required],
    cantidad:         [null as number | null, Validators.required],
    unidadMedida:     ['', Validators.required],
    fechaVencimiento: [''],
    // Cantidad de envases idénticos. Ej: "2 paquetes de 100g cada uno"
    cantidadEnvases:  [1, [Validators.required, Validators.min(1)]],
  });

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    document.body.style.overflow = 'hidden';

    // Autocomplete: consulta al back (catálogo global) y combina con productos
    // ya cargados en la alacena (que tienen stockId + cantidad para sumar).
    if (!this.isEditMode) {
      this.searchInput$.pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          const query = q.trim();
          if (query.length < 2) return of([] as SearchProductoResponse[]);
          return this.productService.searchProductos(query);
        }),
        takeUntil(this.destroy$),
      ).subscribe(results => this.suggestions.set(this.mergeSuggestions(results)));
    }

    if (this.stockItem) {
      // Modo edición: pre-cargar datos y relajar validador de categoría
      const s = this.stockItem;
      this.form.get('categoriaId')?.clearValidators();
      this.form.get('categoriaId')?.updateValueAndValidity();

      this.form.patchValue({
        nombre:           s.nombre ?? '',
        ubicacion:        s.ubicacion ?? 'Alacena',
        cantidad:         s.cantidad ?? null,
        unidadMedida:     this.normalizeUnit(s.unidadMedida),
        fechaVencimiento: s.fechaVencimiento ?? '',
        cantidadEnvases:  s.cantidadEnvases ?? 1,
      });

      this.isOpened.set(s.estaAbierto ?? false);
      this.consumedPct.set(s.porcentajeConsumido ?? 0);
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Acciones ──────────────────────────────────────────────
  onNameInput(value: string): void {
    this.showSuggestions.set(true);
    this.searchInput$.next(value);
  }

  selectSuggestion(s: KnownProduct): void {
    // Mapear el nombre de categoría al id correspondiente
    const catId = this.categoriasOpts.find(
      o => o.label.toLowerCase() === (s.categoriaNombre ?? '').toLowerCase(),
    )?.value ?? '';

    this.form.patchValue({
      nombre:       s.nombre,
      categoriaId:  catId,
      unidadMedida: this.normalizeUnit(s.unidadMedida),
      ubicacion:    s.ubicacion    ?? 'Alacena',
    });
    this.showSuggestions.set(false);
    this.suggestions.set([]);
  }

  toggleOpened(val: boolean): void {
    this.isOpened.set(val);
    if (!val) this.consumedPct.set(0);
  }

  onClose(): void {
    this.closed.emit();
    if (!this.isModal) this.router.navigate(['/alacena']);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.imageError.set(null);
    this.warningMessage = '';

    const validationError = validatePhotoFile(file);
    if (validationError) {
      this.selectedImage.set(null);
      this.imageError.set(validationError);
      input.value = '';
      return;
    }

    this.selectedImage.set(file);
    input.value = '';
  }

  removeSelectedImage(): void {
    this.selectedImage.set(null);
    this.imageError.set(null);
    this.warningMessage = '';
  }

  updateQuantity(delta: number): void {
    const current = this.parseCantidad(this.form.get('cantidad')?.value) || 1;
    this.form.patchValue({ cantidad: Math.max(1, current + delta) });
  }

  updateEnvases(delta: number): void {
    const current = (this.form.get('cantidadEnvases')?.value as number) ?? 1;
    this.form.patchValue({ cantidadEnvases: Math.max(1, current + delta) });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving     = true;
    this.errorMessage = '';
    this.warningMessage = '';

    if (this.isEditMode) {
      this.submitEdit();
    } else {
      this.submitCreate();
    }
  }

  /** Convierte el valor del input (string, puede tener coma decimal) a número */
  private parseCantidad(value: unknown): number {
    const n = Number(String(value ?? '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  private submitCreate(): void {
    const cantidadEnvasesInput = (this.form.value.cantidadEnvases as number) ?? 1;
    const payload = {
      nombre:              this.form.value.nombre!,
      categoriaId:         this.form.value.categoriaId!,
      ubicacion:           this.form.value.ubicacion!,
      cantidad:            this.parseCantidad(this.form.value.cantidad),
      unidadMedida:        this.normalizeUnit(this.form.value.unidadMedida),
      fechaVencimiento:    this.form.value.fechaVencimiento || undefined,
      cantidadEnvases:     cantidadEnvasesInput,
    };

    const isOpened    = this.isOpened();
    const consumedPct = this.consumedPct();
    let imageUploadFailed = false;

    // ¿Ya existe en la alacena con el mismo nombre, unidad y cantidad-por-envase?
    // → en vez de duplicar la tarjeta, sumamos cantidad de envases al existente.
    // Si la cantidad-por-envase difiere, no se hace match: el usuario está
    // cargando una presentación distinta (ej: paquete 100g vs 250g).
    const existing = this.knownProducts.find(p =>
      p.stockId &&
      p.nombre.trim().toLowerCase() === payload.nombre.trim().toLowerCase() &&
      this.normalizeUnit(p.unidadMedida) === payload.unidadMedida &&
      Number(p.cantidad) === payload.cantidad,
    );

    if (existing?.stockId) {
      if (this.selectedImage()) {
        this.imageError.set('Este producto ya existe en tu alacena. Quitá la imagen seleccionada para sumar cantidad sin crear duplicados.');
        this.isSaving = false;
        return;
      }

      const nuevosEnvases = (existing.cantidadEnvases ?? 1) + cantidadEnvasesInput;
      const nuevaCantidad = (existing.cantidad ?? 0) + payload.cantidad;
      this.alacenaApi.updateStock(existing.stockId, { cantidadEnvases: nuevosEnvases, cantidad: nuevaCantidad }).subscribe({
        next: () => {
          this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
          this.form.reset({ cantidad: null, ubicacion: 'Alacena', cantidadEnvases: 1 });
          this.isOpened.set(false);
          this.consumedPct.set(0);
          this.isSaving = false;
          this.closed.emit();
          if (!this.isModal) this.router.navigate(['/alacena']);
        },
        error: (err) => {
          console.error('Error:', err);
          this.errorMessage = 'No se pudo actualizar la cantidad de envases.';
          this.isSaving     = false;
        },
      });
      return;
    }

    // Primero creamos el producto, luego si tiene datos de consumo
    // hacemos un PATCH inmediato porque el endpoint de creación
    // no acepta esos campos (los maneja /alacena/productos).
    this.productService.createStockHome(payload).pipe(
      switchMap(created => {
        const selectedImage = this.selectedImage();
        if (!selectedImage || !created?.productoId) {
          return of(created);
        }

        return this.productService.uploadProductImage(created.productoId, selectedImage).pipe(
          map(() => created),
          catchError((error) => {
            imageUploadFailed = true;
            console.warn('Product was created but image upload failed.', error);
            return of(created);
          }),
        );
      }),
      switchMap(created => {
        const needsPatch = isOpened || consumedPct > 0;
        if (!needsPatch) return of(null);
        const id = created?.stockHogarId;
        if (!id) return of(null);
        return this.alacenaApi.updateStock(id, {
          estaAbierto:         isOpened,
          porcentajeConsumido: consumedPct,
        });
      }),
    ).subscribe({
      next: () => {
        if (imageUploadFailed) {
          this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
          this.resetCreateForm();
          this.warningMessage = 'El producto se guardó, pero no se pudo subir la imagen.';
          this.isSaving = false;
          return;
        }
        this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
        this.resetCreateForm();
        this.isSaving = false;
        this.closed.emit();
        if (!this.isModal) this.router.navigate(['/alacena']);
      },
      error: (err) => {
        console.error('Error:', err);
        this.errorMessage = 'No se pudo guardar el producto.';
        this.isSaving     = false;
      },
    });
  }

  private resetCreateForm(): void {
    this.form.reset({ cantidad: null, ubicacion: 'Alacena', cantidadEnvases: 1 });
    this.isOpened.set(false);
    this.consumedPct.set(0);
    this.selectedImage.set(null);
    this.imageError.set(null);
  }

  private submitEdit(): void {
    const patch = {
      nombre:              this.form.value.nombre!,
      ubicacion:           this.form.value.ubicacion!,
      cantidad:            this.parseCantidad(this.form.value.cantidad),
      unidadMedida:        this.normalizeUnit(this.form.value.unidadMedida),
      fechaVencimiento:    this.form.value.fechaVencimiento || null,
      estaAbierto:         this.isOpened(),
      porcentajeConsumido: this.consumedPct(),
      cantidadEnvases:     (this.form.value.cantidadEnvases as number) ?? 1,
    };

    this.alacenaApi.updateStock(this.stockItem!.id, patch).subscribe({
      next: (updated) => {
        const edited: StockItemResponse = {
          ...updated,
          nombre: patch.nombre,
          ubicacion: patch.ubicacion,
          cantidad: patch.cantidad,
          unidadMedida: patch.unidadMedida,
          fechaVencimiento: patch.fechaVencimiento,
          estaAbierto: patch.estaAbierto,
          porcentajeConsumido: patch.porcentajeConsumido,
          cantidadEnvases: updated.cantidadEnvases,
        };
        this.isSaving = false;
        this.closed.emit(edited);
        if (!this.isModal) this.router.navigate(['/alacena']);
      },
      error: (err) => {
        console.error('Error al editar:', err);
        this.errorMessage = 'No se pudo guardar los cambios.';
        this.isSaving     = false;
      },
    });
  }
}
