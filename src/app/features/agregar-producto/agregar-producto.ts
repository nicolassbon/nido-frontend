import { CommonModule } from '@angular/common';
import { Component, inject, Output, EventEmitter, Input, signal, OnInit, OnDestroy } from '@angular/core';
import { switchMap, of, Subject, debounceTime, distinctUntilChanged, takeUntil, map, catchError, forkJoin } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductService } from '../../core/servicios/agregar-producto.service';
import { AlacenaApiService, StockItemResponse } from '../alacena/alacena-api.service';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ListaComprasService } from '../lista-compras/lista-compras.service';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { CatalogoService, UbicacionDto } from '../../core/servicios/catalogo.service';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';
import { validatePhotoFile } from '../../shared/validators/photo';

/** Producto conocido para autocompletar (proviene de la alacena ya cargada) */
export interface KnownProduct {
  nombre:          string;
  categoriaNombre?: string;
  unidadMedida?:   string;
  ubicacion?:      string;
  stockId?:        string;   // id del stock_hogar si ya está en la alacena
  cantidad?:       number;   // cantidad actual en la alacena
}

export interface InitialProductDraft {
  nombre: string;
  cantidad: number | null;
  unidadMedida: string | null;
  origenCarga?: 'manual' | 'codigo_barras' | 'ticket_compra';
}

@Component({
  selector: 'app-agregar-producto',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NidoSelectComponent, NidoDatepickerComponent],
  templateUrl: './agregar-producto.html',
  styleUrl: './agregar-producto.scss',
})
export class AgregarProducto implements OnInit, OnDestroy {
  /** Cuando se pasa, el form opera en modo edición (PATCH) */
  @Input() stockItem?: StockItemResponse;

  /** Productos ya conocidos (de la alacena) para sugerir al escribir el nombre */
  @Input() knownProducts: KnownProduct[] = [];

  @Input() initialProduct?: InitialProductDraft;

  @Input() syncShoppingListOnSave = true;

  @Input() isModal = false;
  @Output() closed = new EventEmitter<StockItemResponse | void>();
  @Output() saved = new EventEmitter<StockItemResponse | void>();

  private readonly fb                  = inject(FormBuilder);
  private readonly productService      = inject(ProductService);
  private readonly alacenaApi          = inject(AlacenaApiService);
  private readonly router              = inject(Router);
  private readonly authService         = inject(AuthService);
  private readonly listaComprasService = inject(ListaComprasService);
  private readonly catalogoService     = inject(CatalogoService);

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

  // ── Opciones dinámicas (desde la BD) ─────────────────────
  protected categoriasOpts = signal<NidoSelectOption[]>([]);
  protected unidadesOpts   = signal<NidoSelectOption[]>([]);
  protected ubicaciones    = signal<UbicacionDto[]>([]);

  getLocationIcon(loc: UbicacionDto): string  { return loc.icono  ?? 'package'; }
  getLocationColor(loc: UbicacionDto): string { return loc.color  ?? '#263F30'; }

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
  });

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    document.body.style.overflow = 'hidden';

    // Cargar cat\u00e1logos desde la API
    forkJoin({
      cats:  this.catalogoService.getCategorias(),
      units: this.catalogoService.getUnidadesMedida(),
      locs:  this.catalogoService.getUbicaciones(),
    }).subscribe(({ cats, units, locs }) => {
      this.categoriasOpts.set(CatalogoService.toCategoriasOpts(cats));
      this.unidadesOpts.set(CatalogoService.toUnidadesOpts(units));
      this.ubicaciones.set(locs);
    });

    // Autocomplete: filtra los productos ya cargados en la alacena (localmente,
    // sin consultar la BD). Deduplica por nombre.
    if (!this.isEditMode) {
      this.searchInput$.pipe(
        debounceTime(150),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      ).subscribe(q => {
        const query = q.trim().toLowerCase();
        if (query.length < 2) { this.suggestions.set([]); return; }

        const seen = new Set<string>();
        const matches = this.knownProducts.filter(p => {
          if (!p.nombre.toLowerCase().includes(query)) return false;
          const key = p.nombre.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 6);

        this.suggestions.set(matches);
      });
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
      });

      this.isOpened.set(s.estaAbierto ?? false);
      this.consumedPct.set(s.porcentajeConsumido ?? 0);
    } else if (this.initialProduct) {
      this.form.get('categoriaId')?.clearValidators();
      this.form.get('categoriaId')?.updateValueAndValidity();

      this.form.patchValue({
        nombre:       this.initialProduct.nombre,
        ubicacion:    'Alacena',
        cantidad:     this.initialProduct.cantidad,
        unidadMedida: this.normalizeUnit(this.initialProduct.unidadMedida),
      });
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
    const catId = this.categoriasOpts().find(
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
    const isOpened    = this.isOpened();
    const consumedPct = this.consumedPct();
    const payload = {
      nombre:              this.form.value.nombre!,
      categoriaId:         this.form.value.categoriaId || null,
      codigoBarras:        null,
      imagen:              null,
      ubicacion:           this.form.value.ubicacion!,
      cantidad:            this.parseCantidad(this.form.value.cantidad),
      unidadMedida:        this.normalizeUnit(this.form.value.unidadMedida),
      fechaVencimiento:    this.form.value.fechaVencimiento || null,
      estaAbierto:         isOpened,
      porcentajeConsumido: consumedPct,
      origenCarga:         this.initialProduct?.origenCarga ?? 'manual' as const,
    };

    let imageUploadFailed = false;

    // ¿Ya existe en la alacena con el mismo nombre y unidad? → sumar cantidad
    const existing = this.knownProducts.find(p =>
      p.stockId &&
      p.nombre.trim().toLowerCase() === payload.nombre.trim().toLowerCase() &&
      this.normalizeUnit(p.unidadMedida) === payload.unidadMedida,
    );

    if (existing?.stockId) {
      if (this.selectedImage()) {
        this.imageError.set('Este producto ya existe en tu alacena. Quitá la imagen seleccionada para sumar cantidad sin crear duplicados.');
        this.isSaving = false;
        return;
      }

      const nuevaCantidad = (existing.cantidad ?? 0) + payload.cantidad;
      this.alacenaApi.updateStock(existing.stockId, { cantidad: nuevaCantidad }).subscribe({
        next: (updated) => {
          if (this.syncShoppingListOnSave) {
            this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
          }
          this.form.reset({ cantidad: null, ubicacion: 'Alacena' });
          this.isOpened.set(false);
          this.consumedPct.set(0);
          this.isSaving = false;
          this.saved.emit(updated);
          this.closed.emit();
          if (!this.isModal) this.router.navigate(['/alacena']);
        },
        error: (err) => {
          console.error('Error:', err);
          this.errorMessage = 'No se pudo actualizar la cantidad.';
          this.isSaving     = false;
        },
      });
      return;
    }

    // Primero creamos el producto, luego si tiene datos de consumo
    // hacemos un PATCH inmediato porque el endpoint de creación
    // no acepta esos campos (los maneja /alacena/productos).
    this.alacenaApi.createStock(payload).pipe(
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
    ).subscribe({
      next: (created) => {
        if (imageUploadFailed) {
          if (this.syncShoppingListOnSave) {
            this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
          }
          this.resetCreateForm();
          this.warningMessage = 'El producto se guardó, pero no se pudo subir la imagen.';
          this.isSaving = false;
          return;
        }
        if (this.syncShoppingListOnSave) {
          this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
        }
        this.resetCreateForm();
        this.isSaving = false;
        this.saved.emit(created);
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
    this.form.reset({ cantidad: null, ubicacion: 'Alacena' });
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
          origenCarga: updated.origenCarga,
        };
        this.isSaving = false;
        this.saved.emit(edited);
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
