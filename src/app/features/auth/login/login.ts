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
  readonly googleLoginReady = signal(false);

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

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        returnUrl ? this.router.navigateByUrl(returnUrl) : this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 401 || err.status === 403) {
          this.globalError.set('Correo o contraseña incorrectos.');
        } else {
          this.globalError.set('Ocurrió un error. Intentá de nuevo.');
        }
      },
    });
  }

  onGoogleLogin(): void {
    if (!this.googleLoginReady()) {
      this.globalError.set(
        'Google Login no está disponible todavía. Revisá la configuración del cliente.',
      );
      return;
    }

    this.globalError.set(null);

    try {
      const host = this.googleButtonHost()?.nativeElement;
      const renderedGoogleButton = host?.querySelector<HTMLElement>('div[role="button"], iframe');

      if (!renderedGoogleButton) {
        this.googleLoginReady.set(false);
        this.globalError.set(
          'Google Login no está disponible para este origen. Revisá la configuración del cliente.',
        );
        return;
      }

      renderedGoogleButton.click();
    } catch {
      this.globalError.set(
        'Google Login no está disponible para este origen. Revisá la configuración del cliente.',
      );
    }
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

      const renderedGoogleButton = host.querySelector<HTMLElement>('div[role="button"], iframe');
      this.googleLoginReady.set(!!renderedGoogleButton);
    } catch {
      this.googleLoginReady.set(false);
    }
  }

  private handleGoogleCredential(idToken: string): void {
    this.submitted.set(false);
    this.globalError.set(null);
    this.loading.set(true);

    this.auth.googleLogin(idToken).subscribe({
      next: (response: GoogleLoginResponse) => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else if (response.isNewUser) {
          this.router.navigate(['/crear-hogar']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: () => {
        this.loading.set(false);
        this.globalError.set('Error al iniciar sesión con Google.');
      },
    });
  }
}
