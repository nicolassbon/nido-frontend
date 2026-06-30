import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PreferenciasApiService } from '../alacena/preferencias-api.service';
import { HogaresApiService, HogarResumenResponse, MiembroResponse } from '../household/hogares-api.service';
import { PerfilApiService } from '../perfil/perfil-api.service';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { SwPush } from '@angular/service-worker';
import { NotificacionesApiService } from '../notificaciones/services/notificaciones-api.service';
import { TelegramApiService } from '../telegram/telegram-api';
import { ThemeService, ThemeMode } from '../../core/theme/theme.service';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

export function changePasswordValidator(control: AbstractControl): ValidationErrors | null {
  const currentPassword = control.get('currentPassword')?.value;
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  const errors: ValidationErrors = {};

  if (newPassword !== confirmPassword) {
    errors['passwordMismatch'] = true;
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors['sameAsCurrent'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

const MEMBER_COLORS = ['#263F30', '#C78F5A', '#927357', '#5C7A6E', '#8B4513', '#4A7C59'];
const TELEGRAM_PAIRING_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

type TelegramPairingStatus = (typeof TELEGRAM_PAIRING_STATUS)[keyof typeof TELEGRAM_PAIRING_STATUS];

const TELEGRAM_UNLINK_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

type TelegramUnlinkStatus = (typeof TELEGRAM_UNLINK_STATUS)[keyof typeof TELEGRAM_UNLINK_STATUS];

const TELEGRAM_INVALID_DEEP_LINK_MESSAGE = 'No pudimos abrir Telegram porque el enlace devuelto no es válido. Probá de nuevo.';
const TELEGRAM_STATUS_CHECK_ERROR_MESSAGE = 'No pudimos comprobar el estado de Telegram. Conservamos la última conexión conocida. Probá de nuevo en unos segundos.';
const TELEGRAM_BOT_USERNAME = 'nido_app_bot';

interface TelegramPairingErrorBody {
  code?: string;
  title?: string;
}

@Component({
  selector: 'app-configuracion',
  imports: [ReactiveFormsModule, FormsModule, LucideAngularModule, Avatar, DatePipe],
  templateUrl: './configuracion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly perfilApi = inject(PerfilApiService);
  private readonly preferenciasApi = inject(PreferenciasApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly swPush = inject(SwPush);
  private readonly notifApi = inject(NotificacionesApiService);
  private readonly telegramApi = inject(TelegramApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);

  readonly currentTheme = this.themeService.themeMode;

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  private telegramUnlinkSuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private telegramStatusRequestSeq = 0;
  private readonly handleTelegramVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.refreshTelegramStatus();
    }
  };

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
  readonly isWebPushEnabled = signal(false);
  readonly isWebPushLoading = signal(false);
  readonly webPushError = signal<string | null>(null);
  readonly telegramPairingStatus = signal<TelegramPairingStatus>(TELEGRAM_PAIRING_STATUS.IDLE);
  readonly telegramPairingMessage = signal<string | null>(null);
  readonly telegramPairingCode = signal<string | null>(null);
  protected readonly telegramPairingStatusValues = TELEGRAM_PAIRING_STATUS;

  readonly telegramIsLinked = signal(false);
  readonly telegramPairedAt = signal<string | null>(null);
  readonly telegramStatusError = signal<string | null>(null);
  readonly telegramUnlinkStatus = signal<TelegramUnlinkStatus>(TELEGRAM_UNLINK_STATUS.IDLE);
  readonly telegramUnlinkError = signal<string | null>(null);

  // ── Miembros del hogar (Giulianna) ───────────────────────
  readonly members = signal<MiembroResponse[]>([]);
  readonly isLoadingMembers = signal(true);

  // ── Mis hogares ──────────────────────────────────────────
  readonly hogares = signal<HogarResumenResponse[]>([]);
  readonly isLoadingHogares = signal(true);
  readonly hogarActivoId = signal(this.auth.getHogarId() ?? '');
  readonly switchingHogarId = signal<string | null>(null);
  readonly editingHogarId   = signal<string | null>(null);
  readonly editHogarNombre  = signal('');
  readonly savingHogarRename = signal(false);
  readonly renameHogarError = signal('');

  readonly hogarToDelete = signal<HogarResumenResponse | null>(null);
  readonly deletingHogar = signal(false);
  readonly deleteHogarError = signal('');

  // ── Crear hogar (desde configuración) ────────────────────
  readonly showCrearHogarModal = signal(false);
  readonly crearHogarNombre    = signal('');
  readonly crearHogarState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly crearHogarErrorMsg  = signal('');
  readonly crearHogarNombreCreado = signal('');

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
  readonly showCurrentPassword = signal(false);
  readonly showChangeNewPassword = signal(false);
  readonly showChangeConfirmPassword = signal(false);
  readonly showAddNewPassword = signal(false);
  readonly showAddConfirmPassword = signal(false);

  readonly changePasswordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&.]{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
  }, { validators: changePasswordValidator });

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
    this.loadHogares();
    this.checkWebPushStatus();
    this.loadTelegramStatus();

    window.addEventListener('focus', this.refreshTelegramStatus);
    document.addEventListener('visibilitychange', this.handleTelegramVisibilityChange);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', this.refreshTelegramStatus);
      document.removeEventListener('visibilitychange', this.handleTelegramVisibilityChange);
      this.clearTelegramUnlinkSuccessTimeout();
    });
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

  // ── Load & Async logic ───────────────────────────────────
  private loadHogares(): void {
    this.hogaresApi.getMisHogares()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lista => {
          this.hogares.set(lista);
          this.isLoadingHogares.set(false);
        },
        error: () => this.isLoadingHogares.set(false),
      });
  }

  activarHogar(hogarId: string): void {
    if (hogarId === this.hogarActivoId() || this.switchingHogarId() !== null) return;
    this.switchingHogarId.set(hogarId);

    this.hogaresApi.activarHogar(hogarId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.auth.setToken(res.accessToken);
          this.hogarActivoId.set(res.hogarId);
          this.switchingHogarId.set(null);
          this.loadMembers();
        },
        error: () => this.switchingHogarId.set(null),
      });
  }

  openEditHogar(hogar: HogarResumenResponse): void {
    this.editingHogarId.set(hogar.id);
    this.editHogarNombre.set(hogar.nombre);
    this.renameHogarError.set('');
  }

  cancelEditHogar(): void {
    this.editingHogarId.set(null);
    this.editHogarNombre.set('');
    this.renameHogarError.set('');
  }

  saveEditHogar(): void {
    const nombre = this.editHogarNombre().trim();
    const hogarId = this.editingHogarId();
    if (!nombre || !hogarId || this.savingHogarRename()) return;

    this.savingHogarRename.set(true);
    this.renameHogarError.set('');

    this.hogaresApi.renombrarHogar(hogarId, nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.hogares.update(list =>
            list.map(h => h.id === hogarId ? { ...h, nombre: res.nombre } : h)
          );
          this.savingHogarRename.set(false);
          this.editingHogarId.set(null);
        },
        error: err => {
          this.renameHogarError.set(err.error?.message ?? 'No se pudo guardar el nombre.');
          this.savingHogarRename.set(false);
        },
      });
  }

  openEliminarHogarConfirm(hogar: HogarResumenResponse): void {
    this.deleteHogarError.set('');
    this.hogarToDelete.set(hogar);
  }

  closeEliminarHogarConfirm(): void {
    this.hogarToDelete.set(null);
    this.deleteHogarError.set('');
  }

  confirmarEliminarHogar(): void {
    const hogar = this.hogarToDelete();
    if (!hogar || this.deletingHogar()) return;
    this.deletingHogar.set(true);
    this.deleteHogarError.set('');

    this.hogaresApi.eliminarHogar(hogar.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hogarToDelete.set(null);
          this.deletingHogar.set(false);
          this.loadHogares();
        },
        error: err => {
          this.deleteHogarError.set(err.error?.detail ?? 'No se pudo eliminar el hogar.');
          this.deletingHogar.set(false);
        },
      });
  }

  openCrearHogarModal(): void {
    this.showCrearHogarModal.set(true);
  }

  closeCrearHogarModal(): void {
    this.showCrearHogarModal.set(false);
    this.crearHogarNombre.set('');
    this.crearHogarState.set('idle');
    this.crearHogarErrorMsg.set('');
  }

  submitCrearHogar(): void {
    const nombre = this.crearHogarNombre().trim();
    if (!nombre) return;
    this.crearHogarState.set('loading');

    this.hogaresApi.crearHogar(nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.auth.setToken(res.accessToken);
          this.hogarActivoId.set(res.hogarId);
          this.crearHogarNombreCreado.set(res.hogarNombre);
          this.crearHogarState.set('success');
          this.loadHogares();
        },
        error: err => {
          this.crearHogarErrorMsg.set(err.error?.message ?? 'Error al crear el hogar.');
          this.crearHogarState.set('error');
        },
      });
  }

  // ── Actions ──────────────────────────────────────────────
  readonly refreshTelegramStatus = (): void => {
    this.loadTelegramStatus();
  };

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
        if (err.status === 401 || err.error?.title === 'INVALID_CREDENTIALS') {
          this.globalError.set('La contraseña actual no coincide con tu contraseña vigente.');
        } else if (err.status === 400 && err.error?.title === 'PASSWORD_SAME_AS_CURRENT') {
          this.globalError.set('La nueva contraseña no puede ser igual a la actual.');
        } else if (err.status === 400) {
          this.globalError.set('La nueva contraseña no cumple con las reglas de complejidad o la confirmación no coincide.');
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
          this.globalError.set('La contraseña elegida no cumple con las reglas de complejidad o la confirmación no coincide.');
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

  togglePasswordVisibility(field: 'current' | 'changeNew' | 'changeConfirm' | 'addNew' | 'addConfirm'): void {
    switch (field) {
      case 'current':
        this.showCurrentPassword.update(value => !value);
        return;
      case 'changeNew':
        this.showChangeNewPassword.update(value => !value);
        return;
      case 'changeConfirm':
        this.showChangeConfirmPassword.update(value => !value);
        return;
      case 'addNew':
        this.showAddNewPassword.update(value => !value);
        return;
      case 'addConfirm':
        this.showAddConfirmPassword.update(value => !value);
        return;
    }
  }

  private checkWebPushStatus(): void {
    if (!this.swPush.isEnabled) {
      this.isWebPushEnabled.set(false);
      this.webPushError.set('Los Service Workers están desactivados en modo de desarrollo local. Para probarlos, ejecutá "npm run start:pwa" en vez de "npm start".');
      return;
    }

    this.swPush.subscription
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(sub => {
        this.isWebPushEnabled.set(!!sub);
      });
  }

  private loadTelegramStatus(): void {
    const requestSeq = ++this.telegramStatusRequestSeq;
    this.telegramStatusError.set(null);

    this.telegramApi.getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          if (requestSeq !== this.telegramStatusRequestSeq) {
            return;
          }

          this.applyTelegramStatus(status);
        },
        error: () => {
          if (requestSeq !== this.telegramStatusRequestSeq) {
            return;
          }

          this.telegramStatusError.set(TELEGRAM_STATUS_CHECK_ERROR_MESSAGE);
        },
      });
  }

  private applyTelegramStatus(status: { isLinked: boolean; pairedAt?: string }): void {
    this.telegramIsLinked.set(status.isLinked);
    this.telegramPairedAt.set(status.pairedAt ?? null);
    this.telegramStatusError.set(null);
  }

  private resetTelegramLinkState(): void {
    this.telegramIsLinked.set(false);
    this.telegramPairedAt.set(null);
  }

  private clearTelegramUnlinkSuccessTimeout(): void {
    if (this.telegramUnlinkSuccessTimeoutId) {
      clearTimeout(this.telegramUnlinkSuccessTimeoutId);
      this.telegramUnlinkSuccessTimeoutId = null;
    }
  }

  private invalidateTelegramStatusRequests(): void {
    this.telegramStatusRequestSeq += 1;
  }

  disconnectTelegram(): void {
    if (this.telegramUnlinkStatus() === TELEGRAM_UNLINK_STATUS.LOADING) {
      return;
    }

    this.clearTelegramUnlinkSuccessTimeout();
    this.invalidateTelegramStatusRequests();
    this.telegramUnlinkStatus.set(TELEGRAM_UNLINK_STATUS.LOADING);
    this.telegramUnlinkError.set(null);

    this.telegramApi.unlink()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resetTelegramLinkState();
          this.telegramPairingMessage.set(null);
          this.telegramPairingCode.set(null);
          this.telegramStatusError.set(null);
          this.telegramUnlinkStatus.set(TELEGRAM_UNLINK_STATUS.SUCCESS);
          this.clearTelegramUnlinkSuccessTimeout();
          this.telegramUnlinkSuccessTimeoutId = setTimeout(() => {
            this.telegramUnlinkStatus.set(TELEGRAM_UNLINK_STATUS.IDLE);
            this.telegramUnlinkSuccessTimeoutId = null;
          }, 2500);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            this.resetTelegramLinkState();
            this.telegramPairingMessage.set(null);
            this.telegramPairingCode.set(null);
            this.telegramStatusError.set(null);
          }

          this.telegramUnlinkError.set(this.getTelegramUnlinkErrorMessage(error));
          this.telegramUnlinkStatus.set(TELEGRAM_UNLINK_STATUS.ERROR);
        },
      });
  }

  private getTelegramUnlinkErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 404) {
      return 'No encontramos una cuenta de Telegram vinculada.';
    }

    return 'No pudimos desvincular Telegram. Intentá de nuevo.';
  }

  toggleWebPushNotifications(): void {
    if (!this.swPush.isEnabled) {
      this.webPushError.set('Los Service Workers no están habilitados o soportados en este navegador.');
      return;
    }

    this.webPushError.set(null);
    this.isWebPushLoading.set(true);

    if (this.isWebPushEnabled()) {
      this.swPush.unsubscribe()
        .then(() => {
          this.isWebPushEnabled.set(false);
          this.isWebPushLoading.set(false);
        })
        .catch(err => {
          console.error('Error al desuscribirse:', err);
          this.webPushError.set('No se pudo desactivar las notificaciones.');
          this.isWebPushLoading.set(false);
        });
    } else {
      const publicKey = 'BAteOm10_UH08u7RbvEZGU7ogo4ss8IQ9Gf4uu9B0ZEIUv4OiJJm3lBDsA9euwVapq6umtggVUoZBEM1mk6TUgo';
      this.swPush.requestSubscription({ serverPublicKey: publicKey })
        .then(sub => {
          const p256dhRaw = sub.getKey('p256dh');
          const authRaw = sub.getKey('auth');

          if (!p256dhRaw || !authRaw) {
            throw new Error('No se obtuvieron las claves criptográficas de la suscripción.');
          }

          const p256dh = this.arrayBufferToBase64Url(p256dhRaw);
          const auth = this.arrayBufferToBase64Url(authRaw);

          this.notifApi.subscribePush(sub.endpoint, p256dh, auth)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.isWebPushEnabled.set(true);
                this.isWebPushLoading.set(false);
              },
              error: (err) => {
                console.error('Error al enviar la suscripción al servidor:', err);
                this.webPushError.set('Error al registrar las notificaciones en el servidor.');
                this.isWebPushLoading.set(false);
              }
            });
        })
        .catch(err => {
          console.error('Error al solicitar suscripción push:', err);
          if (Notification.permission === 'denied') {
            this.webPushError.set('Permiso de notificaciones denegado. Actívalo en los ajustes de tu navegador.');
          } else {
            this.webPushError.set('No se pudo activar las notificaciones.');
          }
          this.isWebPushLoading.set(false);
        });
    }
  }

  connectTelegram(): void {
    if (this.telegramPairingStatus() === TELEGRAM_PAIRING_STATUS.LOADING) {
      return;
    }

    this.invalidateTelegramStatusRequests();
    this.telegramPairingStatus.set(TELEGRAM_PAIRING_STATUS.LOADING);
    this.telegramPairingMessage.set(null);
    this.telegramPairingCode.set(null);
    this.telegramStatusError.set(null);
    this.resetTelegramLinkState();
    this.telegramUnlinkStatus.set(TELEGRAM_UNLINK_STATUS.IDLE);
    this.telegramUnlinkError.set(null);

    this.telegramApi.startPairing()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ deepLinkUrl, pairingCode }) => {
          this.telegramPairingCode.set(pairingCode);

          if (!this.isAllowedTelegramDeepLink(deepLinkUrl)) {
            this.telegramPairingMessage.set(TELEGRAM_INVALID_DEEP_LINK_MESSAGE);
            this.telegramPairingStatus.set(TELEGRAM_PAIRING_STATUS.ERROR);
            return;
          }

          const telegramWindow = window.open(deepLinkUrl, '_blank', 'noopener,noreferrer');
          this.telegramPairingMessage.set(
            telegramWindow === null
              ? `No pudimos abrir Telegram automáticamente. Abrí este enlace: ${deepLinkUrl} o usá el código ${pairingCode}.`
              : 'Abrimos Telegram para completar la vinculación. Si no se abre, usá el código manual debajo.'
          );
          this.telegramPairingStatus.set(TELEGRAM_PAIRING_STATUS.SUCCESS);
        },
        error: (error: HttpErrorResponse) => {
          this.telegramPairingMessage.set(this.getTelegramPairingErrorMessage(error));
          this.telegramPairingStatus.set(TELEGRAM_PAIRING_STATUS.ERROR);
        },
      });
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private getTelegramPairingErrorMessage(error: HttpErrorResponse): string {
    const errorBody = this.isTelegramPairingErrorBody(error.error) ? error.error : null;
    const errorCode = errorBody?.code ?? errorBody?.title ?? null;

    if (error.status === 429 || errorCode === 'TELEGRAM_PAIRING_RATE_LIMIT_EXCEEDED') {
      return 'Ya generaste un intento hace poco. Esperá un momento y volvé a probar.';
    }

    if (error.status === 503 || errorCode === 'TELEGRAM_CONFIGURATION') {
      return 'Telegram no está disponible en este momento. Intentá nuevamente más tarde.';
    }

    return 'No pudimos iniciar la vinculación con Telegram. Intentá de nuevo.';
  }

  private isAllowedTelegramDeepLink(value: string): boolean {
    try {
      const parsedUrl = new URL(value);

      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 't.me') {
        return false;
      }

      if (parsedUrl.pathname !== `/${TELEGRAM_BOT_USERNAME}`) {
        return false;
      }

      const searchParams = Array.from(parsedUrl.searchParams.entries());

      return searchParams.length === 1 && searchParams[0]?.[0] === 'start' && searchParams[0]?.[1].trim() !== '';
    } catch {
      return false;
    }
  }

  private isTelegramPairingErrorBody(value: unknown): value is TelegramPairingErrorBody {
    return typeof value === 'object' && value !== null;
  }
}
