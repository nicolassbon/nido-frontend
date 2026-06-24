import { Component, computed, inject, signal, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CrearElectrodomesticoRequest,
  Electrodomestico,
  ElectrodomesticoCatalogo,
  ElectrodomesticosService,
} from './services/electrodomesticos.service';

@Component({
  selector: 'app-electrodomesticos',
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './electrodomesticos.html',
  styleUrl: './electrodomesticos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Electrodomesticos {
  protected readonly manualCatalogoValue = '__manual__';

  private readonly electrodomesticosService = inject(ElectrodomesticosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly electrodomesticos = signal<Electrodomestico[]>([]);
  protected readonly catalogo = signal<ElectrodomesticoCatalogo[]>([]);
  protected readonly loading = signal(false);
  protected readonly catalogoLoading = signal(false);
  protected readonly catalogoErrorMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly showAddModal = signal(false);
  protected readonly selectedCatalogoValue = signal('');



  protected readonly draft = signal<CrearElectrodomesticoRequest>({
    catalogoId: null,
    nombre: '',
    tipo: 'Cocina',
    estado: 'activo',
    imagenUrl: null,
  });


  readonly cantidadFueraDeServicio = computed(() =>
    this.electrodomesticos().filter(
      (item) => this.normalizarEstado(item.estado) === 'fuera de servicio'
    ).length
  );

  protected readonly formularioValido = computed(() => {
    const draft = this.draft();
    const selectedValue = this.selectedCatalogoValue();

    if (!selectedValue) {
      return false;
    }

    if (selectedValue === this.manualCatalogoValue) {
      return draft.nombre.trim().length >= 2;
    }

    return Boolean(draft.catalogoId);
  });

  protected readonly modoManual = computed(() =>
    this.selectedCatalogoValue() === this.manualCatalogoValue
  );

  protected readonly catalogoSeleccionado = computed(() => {
    const catalogoId = this.draft().catalogoId;

    if (!catalogoId) {
      return null;
    }

    return this.catalogo().find((item) => item.id === catalogoId) ?? null;
  });

  constructor() {
    this.cargarElectrodomesticos();
    this.cargarCatalogo();
  }

  protected cargarElectrodomesticos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.electrodomesticosService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          console.log('Electrodomésticos recibidos:', response);
          this.electrodomesticos.set(response);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error al cargar electrodomésticos:', error);
          this.errorMessage.set('No se pudieron cargar los electrodomésticos.');
          this.loading.set(false);
        },
      });
  }

  protected abrirModalAgregar(): void {
    this.resetFormulario();
    this.cargarCatalogo();
    this.showAddModal.set(true);
  }

  protected cerrarModal(): void {
    this.showAddModal.set(false);
    this.resetFormulario();
  }

  protected guardarElectrodomestico(): void {
    if (!this.formularioValido()) {
      return;
    }

    const draft = this.draft();
    const manual = this.modoManual();

    const request: CrearElectrodomesticoRequest = {
      catalogoId: manual ? null : draft.catalogoId,
      nombre: draft.nombre.trim(),
      tipo: draft.tipo || 'Otro',
      estado: draft.estado || 'activo',
      imagenUrl: null,
    };

    this.electrodomesticosService.add(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargarElectrodomesticos();
          this.cerrarModal();
        },
        error: (error) => {
          console.error('Error al guardar electrodoméstico:', error);
          this.errorMessage.set('No se pudo guardar el electrodoméstico.');
        },
      });
  }

  protected resetFormulario(): void {
    this.selectedCatalogoValue.set('');
    this.draft.set({
      catalogoId: null,
      nombre: '',
      tipo: 'Cocina',
      estado: 'activo',
      imagenUrl: null,
    });
  }

  protected cargarCatalogo(): void {
    if (this.catalogoLoading() || this.catalogo().length > 0) {
      return;
    }

    this.catalogoLoading.set(true);
    this.catalogoErrorMessage.set(null);

    this.electrodomesticosService.getCatalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.catalogo.set(response);
          this.catalogoLoading.set(false);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar catalogo de electrodomesticos:', error);
          this.catalogoErrorMessage.set('No se pudo cargar el catalogo.');
          this.catalogoLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  protected seleccionarCatalogo(value: string): void {
    this.selectedCatalogoValue.set(value);

    if (!value) {
      this.draft.update((draft) => ({
        ...draft,
        catalogoId: null,
        nombre: '',
        tipo: 'Cocina',
        imagenUrl: null,
      }));
      return;
    }

    if (value === this.manualCatalogoValue) {
      this.draft.update((draft) => ({
        ...draft,
        catalogoId: null,
        nombre: '',
        tipo: 'Cocina',
        imagenUrl: null,
      }));
      return;
    }

    const item = this.catalogo().find((catalogoItem) => catalogoItem.id === value);

    if (!item) {
      return;
    }

    this.draft.update((draft) => ({
      ...draft,
      catalogoId: item.id,
      nombre: item.nombre,
      tipo: item.tipo,
      imagenUrl: item.imagenUrl,
    }));
  }


 protected getIconByElectrodomestico(nombre: string, tipo: string | null): string {
  const value = `${nombre} ${tipo ?? ''}`.toLowerCase();

  if (value.includes('heladera') || value.includes('refrigerador') || value.includes('fridge')) {
    return 'refrigerator';
  }

  if (value.includes('lavarropas') || value.includes('lavadora') || value.includes('washing')) {
    return 'washing-machine';
  }

  if (value.includes('tele') || value.includes('tv') || value.includes('televisor')) {
    return 'tv';
  }

  if (value.includes('microondas')) {
    return 'microwave';
  }

  if (value.includes('cafetera') || value.includes('cafe')) {
    return 'coffee';
  }

  if (tipo === 'Cocina') {
    return 'coffee';
  }

  if (tipo === 'Lavadero') {
    return 'droplet';
  }

  if (tipo === 'Living') {
    return 'tv';
  }

  return 'plug';
}

  protected getColorByTipo(tipo: string | null): string {
    const map: Record<string, string> = {
      Cocina: '#B48B6A',
      Lavadero: '#3E5E4A',
      Living: '#927357',
      Otro: '#6B7280',
    };

    return map[tipo ?? 'Otro'] ?? '#6B7280';
  }

  protected getEstadoClass(estado: string | null): string {
    if (this.normalizarEstado(estado) === 'fuera de servicio') {
      return 'text-red-700 bg-red-100';
    }

    return 'text-green-700 bg-green-100';
  }

  private normalizarEstado(estado: string | null): string {
    return (estado ?? 'activo').trim().toLowerCase();
  }

  protected formatEstado(estado: string | null): string {
    return this.normalizarEstado(estado) === 'fuera de servicio' ? 'Fuera de servicio' : 'Activo';
  }
}
