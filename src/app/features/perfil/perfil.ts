import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { StatCard } from '../../shared/ui/stat-card/stat-card';
import { PreferenceCard } from '../../shared/ui/preference-card/preference-card';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { PerfilApiService, PerfilApiResponse } from './perfil-api.service';
import { OnboardingApiService, RestriccionCatalogo } from '../onboarding/onboarding-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { EditarPerfil } from '../editar-perfil/editar-perfil';
import { Avatar } from '../../shared/ui/avatar/avatar';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, StatCard, PreferenceCard, LucideAngularModule, EditarPerfil, Avatar],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent implements OnInit {
  private readonly perfilApi = inject(PerfilApiService);
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly authService = inject(AuthService);

  protected readonly usuario = signal<PerfilApiResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly apiError = signal<string | null>(null);
  protected readonly nombreHogar = signal<string | null>(null);
  protected readonly statCards = computed(() => {
    const profile = this.usuario();
    const tareasCompletadas = profile?.tareasCompletadas ?? 0;
    const productosEscaneados = profile?.productosEscaneados ?? 0;
    const logros = profile?.logros ?? 0;

    return [
      {
        icon: 'check-square',
        value: tareasCompletadas,
        title: 'Tareas completadas',
        subtitle: tareasCompletadas > 0
          ? 'Tareas terminadas por vos en este hogar.'
          : 'Todavia no hay tareas completadas.',
      },
      {
        icon: 'scan-line',
        value: productosEscaneados,
        title: 'Productos escaneados',
        subtitle: productosEscaneados > 0
          ? 'Productos cargados con codigo de barras.'
          : 'Todavia no hay productos escaneados.',
      },
      {
        icon: 'trophy',
        value: logros,
        title: 'Logros',
        subtitle: logros > 0
          ? 'Logros desbloqueados en tu cuenta.'
          : 'Todavia no hay logros desbloqueados.',
      },
    ];
  });

  // --- Estados de Edición ---
  protected readonly isEditingAlergias = signal(false);
  protected readonly isEditingAlimentacion = signal(false);
  protected readonly isSaving = signal(false);

  // --- Catálogos ---
  protected readonly preferencias = signal<RestriccionCatalogo[]>([]);
  protected readonly allAlergias = signal<RestriccionCatalogo[]>([]);

  // --- Selecciones temporales ---
  protected readonly selectedPreferenciaIds = signal<Set<string>>(new Set());
  protected readonly selectedAlergias = signal<RestriccionCatalogo[]>([]);

  // --- Editar perfil (modal) ---
  protected readonly showEditModal = signal(false);

  protected onEditClosed(saved: boolean): void {
    this.showEditModal.set(false);
    if (saved) this.cargarPerfil();
  }

  // --- Crear hogar adicional ---
  protected readonly showCrearHogarModal = signal(false);
  protected readonly crearHogarNombre    = signal('');
  protected readonly crearHogarState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly crearHogarErrorMsg  = signal('');
  protected readonly crearHogarNombreCreado = signal('');

  protected openCrearHogarModal(): void {
    this.showCrearHogarModal.set(true);
  }

  protected closeCrearHogarModal(): void {
    this.showCrearHogarModal.set(false);
    this.crearHogarNombre.set('');
    this.crearHogarState.set('idle');
    this.crearHogarErrorMsg.set('');
  }

  protected submitCrearHogar(): void {
    const nombre = this.crearHogarNombre().trim();
    if (!nombre) return;

    this.crearHogarState.set('loading');
    this.hogaresApi.crearHogar(nombre).subscribe({
      next: (res) => {
        this.authService.setToken(res.accessToken);
        this.crearHogarNombreCreado.set(res.hogarNombre);
        this.nombreHogar.set(res.hogarNombre);
        this.crearHogarState.set('success');
        this.cargarPerfil();
      },
      error: (err) => {
        this.crearHogarErrorMsg.set(err.error?.message ?? 'Error al crear el hogar.');
        this.crearHogarState.set('error');
      },
    });
  }

  // --- Invitar familiar ---
  protected readonly showInviteModal = signal(false);
  protected readonly inviteEmail     = signal('');
  protected readonly inviteState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly inviteErrorMsg  = signal('');

  protected openInviteModal(): void {
    this.inviteEmail.set('');
    this.inviteState.set('idle');
    this.inviteErrorMsg.set('');
    this.showInviteModal.set(true);
  }

  protected closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  protected submitInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) return;

    this.inviteState.set('loading');
    this.hogaresApi.invitar(email).subscribe({
      next: () => this.inviteState.set('success'),
      error: (err) => {
        this.inviteErrorMsg.set(err.error?.message ?? 'Error al enviar la invitación.');
        this.inviteState.set('error');
      },
    });
  }

  // --- Buscador de Alergias ---
  protected readonly alergiaSearch = signal('');
  protected readonly alergiaInputFocused = signal(false);

  protected readonly alergiaResults = computed(() => {
    const term = this.alergiaSearch().toLowerCase().trim();
    const selectedIds = new Set(this.selectedAlergias().map(a => a.id));
    return this.allAlergias().filter(
      a => !selectedIds.has(a.id) && (term === '' || a.nombre.toLowerCase().includes(term)),
    );
  });

  protected readonly showAlergiaDropdown = computed(
    () => this.alergiaInputFocused() && this.alergiaResults().length > 0,
  );

  ngOnInit(): void {
    this.cargarPerfil();

    this.hogaresApi.getHogar().subscribe({
      next: hogar => this.nombreHogar.set(hogar.nombre),
    });

    // Precargar catálogos
    this.onboardingApi.getPreferenciasAlimentarias().subscribe({
      next: data => this.preferencias.set(data),
    });
    this.onboardingApi.getAlergias().subscribe({
      next: data => this.allAlergias.set(data),
    });
  }

  private cargarPerfil(): void {
    this.perfilApi.getProfile().subscribe({
      next: (profile) => {
        this.usuario.set(profile);
        this.isLoading.set(false);
      },
      error: () => {
        this.apiError.set('No se pudo cargar la información del perfil. Verificá la conexión.');
        this.isLoading.set(false);
      },
    });
  }

  // --- Acciones de Alimentación ---
  protected startEditingAlimentacion(): void {
    const currentNames = this.usuario()?.alimentacion ?? [];
    const matchedIds = this.preferencias()
      .filter(p => currentNames.includes(p.nombre))
      .map(p => p.id);
    
    this.selectedPreferenciaIds.set(new Set(matchedIds));
    this.isEditingAlimentacion.set(true);
  }

  protected cancelEditingAlimentacion(): void {
    this.isEditingAlimentacion.set(false);
  }

  protected saveEditingAlimentacion(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const ids = Array.from(this.selectedPreferenciaIds());
    this.perfilApi.updateRestricciones('restriccion_alimentaria', ids).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isEditingAlimentacion.set(false);
        this.cargarPerfil();
      },
      error: () => {
        this.isSaving.set(false);
        alert('Error al guardar las preferencias de alimentación.');
      }
    });
  }

  protected isPreferenciaSelected(id: string): boolean {
    return this.selectedPreferenciaIds().has(id);
  }

  protected togglePreferencia(id: string): void {
    this.selectedPreferenciaIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  protected getPrefIcon(nombre: string): string {
    const icons: Record<string, string> = {
      'Vegano':       'sprout',
      'Vegetariano':  'leaf',
      'Sin TACC':     'wheat-off',
      'Sin lactosa':  'milk-off',
    };
    return icons[nombre] ?? 'leaf';
  }

  // --- Acciones de Alergias ---
  protected startEditingAlergias(): void {
    const currentNames = this.usuario()?.alergias ?? [];
    const matched = this.allAlergias().filter(a => currentNames.includes(a.nombre));
    
    this.selectedAlergias.set(matched);
    this.alergiaSearch.set('');
    this.isEditingAlergias.set(true);
  }

  protected cancelEditingAlergias(): void {
    this.isEditingAlergias.set(false);
  }

  protected saveEditingAlergias(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const ids = this.selectedAlergias().map(a => a.id);
    this.perfilApi.updateRestricciones('alergia', ids).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isEditingAlergias.set(false);
        this.cargarPerfil();
      },
      error: () => {
        this.isSaving.set(false);
        alert('Error al guardar las alergias.');
      }
    });
  }

  protected addAlergia(alergia: RestriccionCatalogo): void {
    this.selectedAlergias.update(list => [...list, alergia]);
    this.alergiaSearch.set('');
  }

  protected removeAlergia(id: string): void {
    this.selectedAlergias.update(list => list.filter(a => a.id !== id));
  }

  protected onAlergiaBlur(): void {
    setTimeout(() => this.alergiaInputFocused.set(false), 150);
  }

  // --- Clases Auxiliares de Estilos ---
  protected prefCardClass(selected: boolean): string {
    const base = 'relative flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-[1.5px] border-solid cursor-pointer transition-all duration-150 w-full';
    return selected
      ? `${base} bg-nido-green-dark border-nido-green-dark`
      : `${base} bg-white/[0.51] border-nido-border hover:border-nido-green`;
  }

  protected prefIconBgClass(selected: boolean): string {
    return selected
      ? 'w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 transition-all duration-150'
      : 'w-8 h-8 rounded-lg flex items-center justify-center bg-nido-cream transition-all duration-150';
  }

  protected prefIconColorClass(selected: boolean): string {
    return selected ? 'text-nido-cream' : 'text-nido-green';
  }

}
