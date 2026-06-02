import { CommonModule } from '@angular/common';
import { Component, inject, Output, EventEmitter, Input, signal, OnInit, OnDestroy } from '@angular/core';
import { switchMap, of, Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductService } from '../../core/servicios/agregar-producto.service';
import { AlacenaApiService, StockItemResponse } from '../alacena/alacena-api.service';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ListaComprasService } from '../lista-compras/lista-compras.service';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';

/** Producto conocido para autocompletar (proviene de la alacena ya cargada) */
export interface KnownProduct {
  nombre:          string;
  categoriaNombre?: string;
  unidadMedida?:   string;
  ubicacion?:      string;
  stockId?:        string;   // id del stock_hogar si ya está en la alacena
  cantidad?:       number;   // cantidad actual en la alacena
}

@Component({
  selector: 'app-agregar-producto',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule, NidoSelectComponent, NidoDatepickerComponent],
  templateUrl: './agregar-producto.html',
  styleUrl: './agregar-producto.scss',
})
export class AgregarProducto implements OnInit, OnDestroy {
  /** Cuando se pasa, el form opera en modo edición (PATCH) */
  @Input() stockItem?: StockItemResponse;

  /** Productos ya conocidos (de la alacena) para sugerir al escribir el nombre */
  @Input() knownProducts: KnownProduct[] = [];

  @Input() isModal = false;
  @Output() closed = new EventEmitter<void>();

  private readonly fb                  = inject(FormBuilder);
  private readonly productService      = inject(ProductService);
  private readonly alacenaApi          = inject(AlacenaApiService);
  private readonly router              = inject(Router);
  private readonly authService         = inject(AuthService);
  private readonly listaComprasService = inject(ListaComprasService);

  protected isSaving     = false;
  protected errorMessage = '';

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
        unidadMedida:     s.unidadMedida ?? '',
        fechaVencimiento: s.fechaVencimiento ?? '',
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
      unidadMedida: s.unidadMedida ?? '',
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

  updateQuantity(delta: number): void {
    const current = (this.form.get('cantidad')?.value as number) ?? 1;
    this.form.patchValue({ cantidad: Math.max(1, current + delta) });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving     = true;
    this.errorMessage = '';

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
    const payload = {
      nombre:              this.form.value.nombre!,
      categoriaId:         this.form.value.categoriaId!,
      ubicacion:           this.form.value.ubicacion!,
      cantidad:            this.parseCantidad(this.form.value.cantidad),
      unidadMedida:        this.form.value.unidadMedida!,
      fechaVencimiento:    this.form.value.fechaVencimiento || undefined,
    };

    const isOpened    = this.isOpened();
    const consumedPct = this.consumedPct();

    // ¿Ya existe en la alacena con el mismo nombre y unidad? → sumar cantidad
    const existing = this.knownProducts.find(p =>
      p.stockId &&
      p.nombre.trim().toLowerCase() === payload.nombre.trim().toLowerCase() &&
      (p.unidadMedida ?? '') === payload.unidadMedida,
    );

    if (existing?.stockId) {
      const nuevaCantidad = (existing.cantidad ?? 0) + payload.cantidad;
      this.alacenaApi.updateStock(existing.stockId, { cantidad: nuevaCantidad }).subscribe({
        next: () => {
          this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
          this.form.reset({ cantidad: null, ubicacion: 'Alacena' });
          this.isOpened.set(false);
          this.consumedPct.set(0);
          this.isSaving = false;
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
    this.productService.createStockHome(payload).pipe(
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
        this.listaComprasService.marcarCompradoPorNombre(payload.nombre);
        this.form.reset({ cantidad: null, ubicacion: 'Alacena' });
        this.isOpened.set(false);
        this.consumedPct.set(0);
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

  private submitEdit(): void {
    const patch = {
      nombre:              this.form.value.nombre!,
      ubicacion:           this.form.value.ubicacion!,
      cantidad:            this.parseCantidad(this.form.value.cantidad),
      unidadMedida:        this.form.value.unidadMedida || undefined,
      fechaVencimiento:    this.form.value.fechaVencimiento || null,
      estaAbierto:         this.isOpened(),
      porcentajeConsumido: this.consumedPct(),
    };

    this.alacenaApi.updateStock(this.stockItem!.id, patch).subscribe({
      next: () => {
        this.isSaving = false;
        this.closed.emit();
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
