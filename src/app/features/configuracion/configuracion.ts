import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { PerfilApiService } from '../perfil/perfil-api.service';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-configuracion',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './configuracion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly perfilApi = inject(PerfilApiService);

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
  }

  loadProfile(): void {
    this.loadingProfile.set(true);
    this.profileError.set('');

    this.perfilApi.getProfile().subscribe({
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
        this.hasPassword.set(true); // Switch view to Change Password form
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
}
