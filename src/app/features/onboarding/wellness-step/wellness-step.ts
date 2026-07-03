import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import {
  OnboardingApiService,
  RestriccionCatalogo,
  MetaCatalogo,
} from '../onboarding-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService, ThemeMode } from '../../../core/theme/theme.service';
import { ProgressStepsComponent } from '../../../shared/ui/progress-steps/progress-steps.component';

@Component({
  selector: 'app-wellness-step',
  imports: [LucideAngularModule, ProgressStepsComponent],
  templateUrl: './wellness-step.html',
  styleUrl: './wellness-step.scss',
})
export class WellnessStep implements OnInit {
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly router        = inject(Router);
  private readonly auth          = inject(AuthService);
  private readonly themeService  = inject(ThemeService);

  readonly currentTheme = this.themeService.themeMode;

  readonly steps = [
    { number: 1, label: 'Tu Perfil - Crea tu cuenta', completed: true,  active: false },
    { number: 2, label: 'Tu hogar - Convivientes', completed: true,  active: false },
    { number: 3, label: 'Equipamiento - Electrodomésticos', completed: true,  active: false },
    { number: 4, label: 'Finalizar - Preferencias', completed: false, active: true  },
  ];

  // ── Catálogos ───────────────────────────────────────────────
  readonly preferencias = signal<RestriccionCatalogo[]>([]);
  readonly allAlergias  = signal<RestriccionCatalogo[]>([]);
  readonly metas        = signal<MetaCatalogo[]>([]);

  // ── Selecciones ─────────────────────────────────────────────
  readonly selectedPreferenciaIds = signal<Set<string>>(new Set());
  readonly selectedAlergias       = signal<RestriccionCatalogo[]>([]);
  readonly selectedMetaIds        = signal<Set<string>>(new Set());

  // ── Búsqueda de alergias ────────────────────────────────────
  readonly alergiaSearch       = signal('');
  readonly alergiaInputFocused = signal(false);

  readonly alergiaResults = computed(() => {
    const term        = this.alergiaSearch().toLowerCase().trim();
    const selectedIds = new Set(this.selectedAlergias().map(a => a.id));
    return this.allAlergias().filter(
      a => !selectedIds.has(a.id) && (term === '' || a.nombre.toLowerCase().includes(term)),
    );
  });

  readonly showAlergiaDropdown = computed(
    () => this.alergiaInputFocused() && this.alergiaResults().length > 0,
  );

  // ── Estado guardado ─────────────────────────────────────────
  readonly saveState = signal<'idle' | 'saving' | 'error'>('idle');
  readonly showLeaveModal = signal(false);

  onLogoClick(event: Event): void {
    event.stopPropagation();
    this.showLeaveModal.set(true);
  }

  closeLeaveModal(): void {
    this.showLeaveModal.set(false);
  }

  confirmLeave(): void {
    this.showLeaveModal.set(false);
    this.router.navigate(['/']);
  }

  back(): void {
    this.router.navigate(['/equipamiento']);
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  ngOnInit(): void {
    forkJoin({
      preferencias: this.onboardingApi.getPreferenciasAlimentarias(),
      alergias: this.onboardingApi.getAlergias(),
      metas: this.onboardingApi.getMetas()
    }).subscribe({
      next: ({ preferencias, alergias, metas }) => {
        this.preferencias.set(preferencias);
        this.allAlergias.set(alergias);
        this.metas.set(metas);

        this.onboardingApi.getWellness().subscribe({
          next: ({ restriccionIds, metaIds }) => {
            const prefSet = new Set<string>();
            const allergyList: RestriccionCatalogo[] = [];
            const metaSet = new Set<string>();

            const prefCatalogIds = new Set(preferencias.map(p => p.id));
            const allergyMap = new Map(alergias.map(a => [a.id, a]));

            restriccionIds.forEach(id => {
              if (prefCatalogIds.has(id)) {
                prefSet.add(id);
              } else if (allergyMap.has(id)) {
                allergyList.push(allergyMap.get(id)!);
              }
            });

            metaIds.forEach(id => {
              metaSet.add(id);
            });

            this.selectedPreferenciaIds.set(prefSet);
            this.selectedAlergias.set(allergyList);
            this.selectedMetaIds.set(metaSet);
          },
          error: () => {
            this.selectedPreferenciaIds.set(new Set());
            this.selectedAlergias.set([]);
            this.selectedMetaIds.set(new Set());
          },
        });
      }
    });
  }

  // ── Preferencias alimentarias ───────────────────────────────
  isPreferenciaSelected(id: string): boolean {
    return this.selectedPreferenciaIds().has(id);
  }

  togglePreferencia(id: string): void {
    this.selectedPreferenciaIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // ── Alergias ────────────────────────────────────────────────
  addAlergia(alergia: RestriccionCatalogo): void {
    this.selectedAlergias.update(list => [...list, alergia]);
    this.alergiaSearch.set('');
  }

  removeAlergia(id: string): void {
    this.selectedAlergias.update(list => list.filter(a => a.id !== id));
  }

  onAlergiaBlur(): void {
    setTimeout(() => this.alergiaInputFocused.set(false), 150);
  }

  // ── Metas ────────────────────────────────────────────────────
  isMetaSelected(id: string): boolean {
    return this.selectedMetaIds().has(id);
  }

  toggleMeta(id: string): void {
    this.selectedMetaIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  getMetaIcon(nombre: string): string {
    const icons: Record<string, string> = {
      'Ahorro':               'trending-up',
      'Mejor organización':   'clipboard-list',
    };
    return icons[nombre] ?? 'star';
  }

  // ── Estilos dinámicos ────────────────────────────────────────
  getPrefIcon(nombre: string): string {
    const icons: Record<string, string> = {
      'Vegano':       'sprout',
      'Vegetariano':  'leaf',
      'Sin TACC':     'wheat-off',
      'Sin lactosa':  'milk-off',
    };
    return icons[nombre] ?? 'leaf';
  }

  prefCardClass(selected: boolean): string {
    const base = 'relative flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-[1.5px] border-solid cursor-pointer transition-all duration-150';
    return selected
      ? `${base} bg-nido-green-dark border-nido-green-dark`
      : `${base} bg-white/[0.51] border-nido-border hover:border-nido-green`;
  }

  prefIconBgClass(selected: boolean): string {
    return selected
      ? 'w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 transition-all duration-150'
      : 'w-8 h-8 rounded-lg flex items-center justify-center bg-nido-cream transition-all duration-150';
  }

  prefIconColorClass(selected: boolean): string {
    return selected ? 'text-nido-cream' : 'text-nido-green';
  }

  goalCardClass(selected: boolean): string {
    const base = 'w-full flex items-center justify-between p-4 rounded-xl border-[1.5px] border-solid cursor-pointer transition-all duration-150 text-left';
    return selected
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-white/[0.51] border-nido-border text-nido-green-dark hover:border-nido-green`;
  }

  goalIconBgClass(selected: boolean): string {
    return selected
      ? 'w-9 h-9 rounded-lg flex items-center justify-center bg-white/15 transition-all duration-150'
      : 'w-9 h-9 rounded-lg flex items-center justify-center bg-nido-cream transition-all duration-150';
  }

  goalIconColorClass(selected: boolean): string {
    return selected ? 'text-nido-cream' : 'text-nido-gold';
  }

  stepCircleClass(step: { completed: boolean; active: boolean }): string {
    if (step.completed || step.active) {
      return 'w-8 h-8 rounded-full bg-nido-cream flex items-center justify-center shrink-0';
    }
    return 'w-8 h-8 rounded-full border-2 border-solid border-[rgba(247,241,230,0.35)] flex items-center justify-center shrink-0';
  }

  stepLabelClass(step: { active: boolean }): string {
    return step.active
      ? 'hidden text-[0.65rem] whitespace-nowrap text-nido-cream font-semibold sm:block'
      : 'hidden text-[0.65rem] whitespace-nowrap text-[rgba(247,241,230,0.45)] sm:block';
  }

  // ── Acciones ─────────────────────────────────────────────────
  next(): void {
    if (this.saveState() === 'saving') return;
    this.saveState.set('saving');

    const restriccionIds = [
      ...Array.from(this.selectedPreferenciaIds()),
      ...this.selectedAlergias().map(a => a.id),
    ];

    this.onboardingApi.saveWellnessStep({
      skip:          false,
      usuarioId:     this.auth.getUserId(),
      hogarId:       this.auth.getHogarId(),
      restriccionIds,
      metaIds:       Array.from(this.selectedMetaIds()),
    }).subscribe({
      next:  () => this.router.navigate(['/inicio']),
      error: () => this.saveState.set('error'),
    });
  }

  skip(): void {
    this.onboardingApi.saveWellnessStep({
      skip:          true,
      usuarioId:     this.auth.getUserId(),
      hogarId:       this.auth.getHogarId(),
      restriccionIds: [],
      metaIds:        [],
    }).subscribe({
      next:  () => this.router.navigate(['/inicio']),
      error: () => this.router.navigate(['/inicio']),
    });
  }
}
