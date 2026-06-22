import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ElectrodomesticoCatalogo,
  ElectrodomesticosService,
} from '../../electrodomesticos/services/electrodomesticos.service';
import { OnboardingApiService } from '../onboarding-api.service';
import { ProgressStepsComponent } from '../../../shared/ui/progress-steps/progress-steps.component';

@Component({
  selector: 'app-equipment-step',
  imports: [LucideAngularModule, ProgressStepsComponent],
  templateUrl: './equipment-step.html',
  styleUrl: './equipment-step.scss',
})
export class EquipmentStep implements OnInit {
  private readonly electrodomesticos = inject(ElectrodomesticosService);
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly catalogo = signal<ElectrodomesticoCatalogo[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showLeaveModal = signal(false);

  readonly steps = [
    { number: 1, label: 'Tu Perfil - Crea tu cuenta', completed: true, active: false },
    { number: 2, label: 'Tu hogar - Convivientes', completed: true, active: false },
    { number: 3, label: 'Equipamiento - Electrodomésticos', completed: false, active: true },
    { number: 4, label: 'Finalizar - Preferencias', completed: false, active: false },
  ];

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
    this.router.navigate(['/crear-hogar']);
  }

  ngOnInit(): void {
    this.electrodomesticos.getCatalogo().subscribe({
      next: data => {
        this.catalogo.set(data);

        this.electrodomesticos.getAll().subscribe({
          next: userEquipments => {
            const savedIds = new Set<string>();
            userEquipments.forEach(eq => {
              if (eq.catalogoId) {
                savedIds.add(eq.catalogoId);
              }
            });
            this.selectedIds.set(savedIds);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.error.set('No pudimos cargar el catálogo.');
        this.loading.set(false);
      },
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  next(): void {
    if (this.saving()) return;

    const selected = this.catalogo().filter(item => this.selectedIds().has(item.id));

    this.saving.set(true);
    this.onboardingApi.saveEquipmentStep({
      skip: false,
      usuarioId: this.auth.getUserId(),
      hogarId: this.auth.getHogarId(),
      equipments: selected.map(item => ({
        catalogoId: item.id,
        nombre: item.nombre,
        tipo: item.tipo,
        estado: 'activo',
      })),
    }).subscribe({
      next: () => this.router.navigate(['/finalizar-hogar']),
      error: () => {
        this.error.set('No pudimos guardar el equipamiento.');
        this.saving.set(false);
      },
    });
  }

  skip(): void {
    this.onboardingApi.saveEquipmentStep({
      skip: true,
      usuarioId: this.auth.getUserId(),
      hogarId: this.auth.getHogarId(),
      equipments: [],
    }).subscribe({
      next: () => this.router.navigate(['/finalizar-hogar']),
      error: () => this.router.navigate(['/finalizar-hogar']),
    });
  }

  iconName(item: ElectrodomesticoCatalogo): string {
    const icons: Record<string, string> = {
      blender: 'blend',
      microwave: 'microwave',
      'cooking-pot': 'cooking-pot',
      blend: 'blend',
      cog: 'cog',
      'air-vent': 'air-vent',
      coffee: 'coffee',
      square: 'square',
      'pressure-cooker': 'cooking-pot',
      grill: 'flame',
    };

    return icons[item.icono ?? ''] ?? 'plug-zap';
  }

  cardClass(selected: boolean): string {
    const base = 'relative flex flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] min-h-[110px] p-4 transition';

    return selected
      ? `${base} bg-nido-green-dark text-nido-cream border-nido-green-dark shadow-[0_6px_18px_rgba(38,63,48,0.18)]`
      : `${base} bg-white/[0.51] text-nido-green-dark border-nido-border hover:border-nido-green hover:bg-[rgba(62,94,74,0.04)]`;
  }

  iconClass(selected: boolean): string {
    return selected ? 'text-nido-cream' : 'text-nido-green-dark';
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
}
