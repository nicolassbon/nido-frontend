import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Bell, Users, User, LogOut, LucideIconData, UserPlus, Trash2 } from 'lucide-angular';
import { PreferenciasApiService } from '../../alacena/preferencias-api.service';
import { HogaresApiService, MiembroResponse } from '../../household/hogares-api.service';
import { AuthService } from '../../../core/auth/auth.service';

const MEMBER_COLORS = ['#263F30', '#C78F5A', '#927357', '#5C7A6E', '#8B4513', '#4A7C59'];

@Component({
  selector: 'app-configuracion',
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion implements OnInit {
  private readonly preferenciasApi = inject(PreferenciasApiService);
  private readonly hogaresApi      = inject(HogaresApiService);
  private readonly authService     = inject(AuthService);
  private readonly destroyRef      = inject(DestroyRef);

  // ── Cuenta ───────────────────────────────────────────────
  protected readonly userName = signal(this.authService.getNombre() ?? '');
  protected readonly email    = signal(this.authService.getEmail() ?? '');
  protected readonly userId   = signal(this.authService.getUserId() ?? '');

  // ── Notificaciones ───────────────────────────────────────
  protected readonly diasAlerta      = signal(7);
  protected readonly diasAlertaInput = signal(7);
  protected readonly isSavingPrefs   = signal(false);
  protected readonly saveSuccess     = signal(false);
  protected readonly isLoadingPrefs  = signal(true);

  // ── Miembros del hogar ───────────────────────────────────
  protected readonly members        = signal<MiembroResponse[]>([]);
  protected readonly isLoadingMembers = signal(true);

  // ── Invitar convivente ───────────────────────────────────
  protected readonly inviteEmail   = signal('');
  protected readonly inviteState   = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly inviteErrorMsg = signal('');

  protected readonly icons: Record<string, LucideIconData> = {
    bell:       Bell,
    users:      Users,
    user:       User,
    'log-out':  LogOut,
    'user-plus': UserPlus,
    'trash-2':  Trash2,
  };

  ngOnInit(): void {
    this.loadPreferences();
    this.loadMembers();
  }

  private loadPreferences(): void {
    this.preferenciasApi.getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prefs => {
          this.diasAlerta.set(prefs.diasAlerta);
          this.diasAlertaInput.set(prefs.diasAlerta);
          this.isLoadingPrefs.set(false);
        },
        error: () => this.isLoadingPrefs.set(false),
      });
  }

  private loadMembers(): void {
    this.hogaresApi.getMiembros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: miembros => {
          this.members.set(miembros);
          this.isLoadingMembers.set(false);
        },
        error: () => this.isLoadingMembers.set(false),
      });
  }

  protected saveDiasAlerta(): void {
    const dias = Math.max(1, Math.min(365, Math.round(this.diasAlertaInput()) || 7));
    this.isSavingPrefs.set(true);
    this.saveSuccess.set(false);

    this.preferenciasApi.updatePreferences(dias)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prefs => {
          this.diasAlerta.set(prefs.diasAlerta);
          this.diasAlertaInput.set(prefs.diasAlerta);
          this.isSavingPrefs.set(false);
          this.saveSuccess.set(true);
          setTimeout(() => this.saveSuccess.set(false), 2500);
        },
        error: () => this.isSavingPrefs.set(false),
      });
  }

  protected submitInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) return;
    this.inviteState.set('loading');

    this.hogaresApi.invitar(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.inviteState.set('success');
          this.inviteEmail.set('');
        },
        error: err => {
          this.inviteErrorMsg.set(err.error?.message ?? 'Error al enviar la invitación.');
          this.inviteState.set('error');
        },
      });
  }

  protected resetInvite(): void {
    this.inviteState.set('idle');
    this.inviteErrorMsg.set('');
    this.inviteEmail.set('');
  }

  protected memberColor(index: number): string {
    return MEMBER_COLORS[index % MEMBER_COLORS.length];
  }

  protected memberInitial(nombre: string): string {
    return nombre[0]?.toUpperCase() ?? '?';
  }

  protected isCurrentUser(miembro: MiembroResponse): boolean {
    return miembro.usuarioId === this.userId();
  }

  protected logout(): void {
    this.authService.logout().subscribe();
  }
}
