import { Component, computed, inject, signal, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CrearElectrodomesticoRequest,
  Electrodomestico,
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
  private readonly electrodomesticosService = inject(ElectrodomesticosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // Temporal: más adelante esto debería venir del usuario/hogar logueado.
  private readonly hogarId = '83e0bb2b-8585-469c-86d7-802cddb2434a';

  protected readonly electrodomesticos = signal<Electrodomestico[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly showAddModal = signal(false);

  protected readonly searchQuery = signal('');
  protected readonly activeTipo = signal('Todos');

  protected readonly tipos = ['Todos', 'Cocina', 'Lavadero', 'Living', 'Otro'];

  protected readonly draft = signal<CrearElectrodomesticoRequest>({
    hogarId: this.hogarId,
    nombre: '',
    tipo: 'Cocina',
    estado: 'Activo',
  });

  protected readonly electrodomesticosFiltrados = computed(() => {
    let lista = this.electrodomesticos();

    const tipoActivo = this.activeTipo();

    if (tipoActivo !== 'Todos') {
      lista = lista.filter((item) => (item.tipo ?? 'Otro') === tipoActivo);
    }

    const busqueda = this.searchQuery().trim().toLowerCase();

    if (busqueda) {
      lista = lista.filter((item) =>
        item.nombre.toLowerCase().includes(busqueda)
      );
    }

    return lista;
  });

  protected readonly cantidadMantenimiento = computed(() =>
    this.electrodomesticos().filter(
      (item) => item.estado === 'Necesita mantenimiento'
    ).length
  );

  protected readonly formularioValido = computed(() => {
    const draft = this.draft();
    return draft.nombre.trim().length >= 2;
  });

  constructor() {
    this.cargarElectrodomesticos();
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

    const request: CrearElectrodomesticoRequest = {
      hogarId: this.hogarId,
      nombre: draft.nombre.trim(),
      tipo: draft.tipo || 'Otro',
      estado: draft.estado || 'Activo',
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
    this.draft.set({
      hogarId: this.hogarId,
      nombre: '',
      tipo: 'Cocina',
      estado: 'Activo',
    });
  }

  protected tipoChipClass(tipo: string): string {
    const base =
      'px-4 py-2 rounded-full text-sm font-medium border transition cursor-pointer';

    return this.activeTipo() === tipo
      ? `${base} bg-nido-green-dark text-nido-cream border-nido-green-dark`
      : `${base} bg-white text-nido-green-dark border-nido-border hover:bg-nido-cream`;
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
      Cocina: '#C78F5A',
      Lavadero: '#3E5E4A',
      Living: '#927357',
      Otro: '#6B7280',
    };

    return map[tipo ?? 'Otro'] ?? '#6B7280';
  }

  protected getEstadoClass(estado: string | null): string {
    if (estado === 'Necesita mantenimiento') {
      return 'text-orange-700 bg-orange-100';
    }

    if (estado === 'Fuera de servicio') {
      return 'text-red-700 bg-red-100';
    }

    return 'text-green-700 bg-green-100';
  }
}
