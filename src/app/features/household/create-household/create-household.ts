import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap, timer } from 'rxjs';
import { HogaresApiService } from '../hogares-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OnboardingApiService } from '../../onboarding/onboarding-api.service';

const MEMBER_COLORS = ['#263F30', '#B48B6A', '#927357', '#5C7A6E', '#8B4513', '#4A7C59'];

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  color: string;
  initials: string;
  fotoUrl?: string | null;
  isCurrentUser?: boolean;
}

@Component({
  selector: 'app-create-household',
  imports: [LucideAngularModule],
  templateUrl: './create-household.html',
  styleUrl: './create-household.scss',
})
export class CreateHousehold {
  private readonly hogaresApi    = inject(HogaresApiService);
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly auth          = inject(AuthService);
  private readonly router        = inject(Router);

  readonly steps = [
    { number: 1, label: 'Tu cuenta',    completed: true,  active: false },
    { number: 2, label: 'Tu hogar',     completed: false, active: true  },
    { number: 3, label: 'Equipamiento', completed: false, active: false },
    { number: 4, label: 'Finalizar',    completed: false, active: false },
  ];

  readonly members = signal<FamilyMember[]>([]);

  readonly sortedMembers = computed(() => {
    const list = this.members();
    const me = list.find(m => m.isCurrentUser);
    const others = list.filter(m => !m.isCurrentUser);
    return me ? [me, ...others] : others;
  });

  readonly openMenuId = signal<string | null>(null);

  readonly showInviteModal = signal(false);
  readonly inviteEmail     = signal('');
  readonly inviteState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly inviteErrorMsg  = signal('');
  readonly saving          = signal(false);
  readonly saveErrorMsg    = signal('');

  constructor() {
    const currentUserId = this.auth.getUserId();
    const currentUserName = this.auth.getNombre() ?? 'Tú';
    this.members.set([
      {
        id: currentUserId ?? 'current-user',
        name: currentUserName,
        role: 'Tú',
        color: MEMBER_COLORS[0],
        initials: currentUserName[0]?.toUpperCase() ?? '?',
        isCurrentUser: true,
      },
    ]);

    timer(0, 5000).pipe(
      switchMap(() => this.hogaresApi.getMiembros()),
      takeUntilDestroyed(),
    ).subscribe({
      next: (miembros) => {
        if (miembros.length === 0) return;
        this.members.set(
          miembros.map((m, i) => ({
            id:            m.usuarioId,
            name:          m.nombre,
            role:          m.rol,
            color:         MEMBER_COLORS[i % MEMBER_COLORS.length],
            initials:      m.nombre[0]?.toUpperCase() ?? '?',
            fotoUrl:       m.fotoUrl,
            isCurrentUser: m.usuarioId === currentUserId,
          })),
        );
      },
      error: () => {},
    });
  }


  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.update(cur => cur === id ? null : id);
  }

  closeMenus(): void {
    this.openMenuId.set(null);
  }

  removeMember(id: string): void {
    this.openMenuId.set(null);
    this.hogaresApi.removeMiembro(id).subscribe({
      next: () => this.members.update(list => list.filter(m => m.id !== id)),
    });
  }

  addMember(): void {
    this.inviteEmail.set('');
    this.inviteState.set('idle');
    this.inviteErrorMsg.set('');
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  submitInvite(): void {
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

  next(): void {
    this.saveHouseholdStep(false, '/equipamiento');
  }

  skip(): void {
    this.saveHouseholdStep(true, '/equipamiento');
  }

  private saveHouseholdStep(skip: boolean, route: string): void {
    if (this.saving()) return;

    this.saving.set(true);
    this.saveErrorMsg.set('');

    this.onboardingApi.saveHouseholdStep({
      skip,
      usuarioId: this.auth.getUserId(),
      hogarId: this.auth.getHogarId(),
      members: [],
    }).subscribe({
      next: () => this.router.navigate([route]),
      error: () => {
        this.saveErrorMsg.set('No pudimos guardar los datos de tu hogar. Intentá de nuevo.');
        this.saving.set(false);
      },
    });
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
