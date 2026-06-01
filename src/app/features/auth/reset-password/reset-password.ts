import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, LucideAngularModule, RouterLink],
  templateUrl: './reset-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private readonly token: string;

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly loading = signal(false);
  readonly globalError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly success = signal(false);
  readonly noTokenError = signal(false);

  readonly form = this.fb.nonNullable.group({
    password: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&.]{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatchValidator });

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.noTokenError.set(true);
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.globalError.set(null);

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const { password, confirmPassword } = this.form.getRawValue();

    this.auth.resetPassword({
      token: this.token,
      newPassword: password,
      newPasswordConfirmation: confirmPassword,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.globalError.set('El enlace de recuperación es inválido o ha expirado. Solicitá uno nuevo.');
        } else {
          this.globalError.set('Ocurrió un error al restablecer la contraseña. Intentá de nuevo.');
        }
      },
    });
  }
}
