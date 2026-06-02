import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PreferenciasApiService } from '../alacena/preferencias-api.service';
import { HogaresApiService, MiembroResponse } from '../household/hogares-api.service';
import { PerfilApiService } from '../perfil/perfil-api.service';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

const MEMBER_COLORS = ['#263F30', '#C78F5A', '#927357', '#5C7A6E', '#8B4513', '#4A7C59'];

@Component({
  selector: 'app-configuracion',
  imports: [ReactiveFormsModule, FormsModule, LucideAngularModule],
  templateUrl: './configuracion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly perfilApi = inject(PerfilApiService);
  private readonly preferenciasApi = inject(PreferenciasApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Cuenta (Giulianna) ───────────────────────────────────
  readonly userName = signal(this.auth.getNombre() ?? '');
  readonly email = signal(this.auth.getEmail() ?? '');
  readonly userId = signal(this.auth.getUserId() ?? '');

  // ── Notificaciones (Giulianna) ───────────────────────────
  readonly diasAlerta = signal(7);
  readonly diasAlertaInput = signal(7);
  readonly isSavingPrefs = signal(false);
  readonly saveSuccess = signal(false);
  readonly isLoadingPrefs = signal(true);

  // ── Miembros del hogar (Giulianna) ───────────────────────
  readonly members = signal<MiembroResponse[]>([]);
  readonly isLoadingMembers = signal(true);

  // ── Invitar convivente (Giulianna) ───────────────────────
  readonly showInviteModal = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteState = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly inviteErrorMsg = signal('');

  // ── Seguridad (Us) ───────────────────────────────────────
  readonly loadingProfile = signal(true);
  readonly profileError = signal('');
  readonly hasPassword = signal(false);
  readonly hasGoogleLinked = signal(false);
  readonly saving = signal(false);
  readonly globalError = signal<string | null>(null);
  readonly globalSuccess = signal<string | null>(null);
  readonly changeSubmitted = signal(false);
  readonly addSubmitted = signal(false);

  readonly changePasswordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&.]{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  readonly addPasswordForm = this.fb.nonNullable.group({
    newPassword: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&.]{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  constructor() {
    this.loadProfile();
    this.loadPreferences();
    this.loadMembers();
  }

  // ── Load & Async logic ───────────────────────────────────
  loadProfile(): void {
    this.loadingProfile.set(true);
    this.profileError.set('');

    this.perfilApi.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.hasPassword.set(!!profile.hasPassword);
          this.hasGoogleLinked.set(!!profile.hasGoogleLinked);
          this.loadingProfile.set(false);
        },
        error: () => {
          this.profileError.set('No pudimos cargar la información de seguridad de tu cuenta.');
          this.loadingProfile.set(false);
        },
      });
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

  // ── Actions ──────────────────────────────────────────────
  saveDiasAlerta(): void {
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

  openInviteModal(): void {
    this.resetInvite();
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  submitInvite(): void {
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

  resetInvite(): void {
    this.inviteState.set('idle');
    this.inviteErrorMsg.set('');
    this.inviteEmail.set('');
  }

  onChangePasswordSubmit(): void {
    this.changeSubmitted.set(true);
    this.globalError.set(null);
    this.globalSuccess.set(null);

    if (this.changePasswordForm.invalid) {
      return;
    }

    this.saving.set(true);
    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.getRawValue();

    this.auth.changePassword({
      currentPassword,
      newPassword,
      newPasswordConfirmation: confirmPassword,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.globalSuccess.set('¡Tu contraseña ha sido cambiada con éxito!');
        this.changeSubmitted.set(false);
        this.changePasswordForm.reset();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 401 || err.status === 400) {
          this.globalError.set('La contraseña actual es incorrecta o la nueva contraseña no cumple con las reglas de complejidad.');
        } else {
          this.globalError.set('Ocurrió un error al cambiar la contraseña. Intentá de nuevo.');
        }
      },
    });
  }

  onAddPasswordSubmit(): void {
    this.addSubmitted.set(true);
    this.globalError.set(null);
    this.globalSuccess.set(null);

    if (this.addPasswordForm.invalid) {
      return;
    }

    this.saving.set(true);
    const { newPassword, confirmPassword } = this.addPasswordForm.getRawValue();

    this.auth.addPassword({
      newPassword,
      newPasswordConfirmation: confirmPassword,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.globalSuccess.set('¡Tu contraseña de acceso ha sido creada con éxito!');
        this.hasPassword.set(true); // Switch to Change Password view
        this.addSubmitted.set(false);
        this.addPasswordForm.reset();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 400) {
          this.globalError.set('La contraseña elegida no cumple con las reglas de complejidad.');
        } else {
          this.globalError.set('Ocurrió un error al crear la contraseña. Intentá de nuevo.');
        }
      },
    });
  }

  // ── UI Helpers ───────────────────────────────────────────
  memberColor(index: number): string {
    return MEMBER_COLORS[index % MEMBER_COLORS.length];
  }

  memberInitial(nombre: string): string {
    return nombre[0]?.toUpperCase() ?? '?';
  }

  isCurrentUser(miembro: MiembroResponse): boolean {
    return miembro.usuarioId === this.userId();
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
