import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService, type GoogleLoginResponse } from '../../../core/auth/auth.service';
import { GoogleIdentityService } from '../../../core/auth/google-identity.service';
import { getSafeApprovedPaymentReturnUrl } from '../../../core/payment-return';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LucideAngularModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly googleButtonHost = viewChild<ElementRef<HTMLElement>>('googleButtonHost');

  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly globalError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly paymentContinuationFailed = signal(false);
  protected readonly paymentReturnUrl = getSafeApprovedPaymentReturnUrl(
    this.router,
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );
  protected readonly hasApprovedPaymentReturn = this.paymentReturnUrl !== null;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    afterNextRender(() => {
      void this.initializeGoogleButton();
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.globalError.set(null);
    this.paymentContinuationFailed.set(false);

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.navigateAfterAuthentication(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.globalError.set(
            'Esta cuenta se registró con Google y todavía no tiene contraseña. Iniciá sesión con Google, o creá una contraseña desde Configuración.',
          );
        } else if (err.status === 401 || err.status === 403) {
          this.globalError.set('Correo o contraseña incorrectos.');
        } else {
          this.globalError.set('Ocurrió un error. Intentá de nuevo.');
        }
      },
    });
  }

  private async initializeGoogleButton(): Promise<void> {
    const host = this.googleButtonHost()?.nativeElement;

    if (!host) {
      return;
    }

    try {
      await this.googleIdentity.renderButton(host, (idToken) =>
        this.handleGoogleCredential(idToken),
      );

      this.globalError.set(null);
    } catch {
      this.globalError.set(
        'Google Login no está disponible para este origen. Revisá la configuración del cliente.',
      );
    }
  }

  private handleGoogleCredential(idToken: string): void {
    this.submitted.set(false);
    this.globalError.set(null);
    this.paymentContinuationFailed.set(false);
    this.loading.set(true);

    this.auth.googleLogin(idToken).subscribe({
      next: (response: GoogleLoginResponse) => {
        this.loading.set(false);
        this.navigateAfterAuthentication(response.isNewUser ? ['/crear-hogar'] : ['/']);
      },
      error: () => {
        this.loading.set(false);
        this.globalError.set('Error al iniciar sesión con Google.');
      },
    });
  }

  private navigateAfterAuthentication(fallbackCommands: string[]): void {
    if (!this.paymentReturnUrl) {
      void this.router.navigate(fallbackCommands);
      return;
    }

    void this.router.navigateByUrl(this.paymentReturnUrl)
      .then(navigated => {
        if (!navigated) {
          this.paymentContinuationFailed.set(true);
        }
      })
      .catch(() => {
        this.paymentContinuationFailed.set(true);
      });
  }
}
