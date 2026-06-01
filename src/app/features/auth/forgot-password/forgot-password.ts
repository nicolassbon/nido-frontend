import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, LucideAngularModule, RouterLink],
  templateUrl: './forgot-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly globalError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly success = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    this.submitted.set(true);
    this.globalError.set(null);

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const email = this.form.getRawValue().email;

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.globalError.set('Ocurrió un error al enviar el correo. Intentá de nuevo.');
      },
    });
  }
}
