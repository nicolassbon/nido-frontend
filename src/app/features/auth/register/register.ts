import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService, type GoogleLoginResponse } from '../../../core/auth/auth.service';
import { GoogleIdentityService } from '../../../core/auth/google-identity.service';
import { validatePhotoFile } from '../../../shared/validators/photo';
import { NidoSelectComponent, NidoSelectOption } from '../../../shared/ui/form/nido-select/nido-select';
import { ProgressStepsComponent } from '../../../shared/ui/progress-steps/progress-steps.component';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, LucideAngularModule, NidoSelectComponent, RouterLink, ProgressStepsComponent],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly googleButtonHost = viewChild<ElementRef<HTMLElement>>('googleButtonHost');
  private photoObjectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearSelectedPhoto());

    afterNextRender(() => {
      void this.initializeGoogleButton();
    });
  }

  readonly steps = [
    { number: 1, label: 'Tu Perfil - Crea tu cuenta', completed: false, active: true  },
    { number: 2, label: 'Tu hogar - Convivientes', completed: false, active: false },
    { number: 3, label: 'Equipamiento - Electrodomésticos', completed: false, active: false },
    { number: 4, label: 'Finalizar - Preferencias', completed: false, active: false },
  ];

  readonly showPassword        = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly photoPreview        = signal<string | null>(null);
  readonly selectedPhoto       = signal<File | null>(null);
  readonly photoError          = signal<string | null>(null);
  readonly loading             = signal(false);
  readonly globalError         = signal<string | null>(null);
  readonly submitted           = signal(false);

  readonly sexoOptions: NidoSelectOption[] = [
    { value: 'Masculino',           label: 'Masculino' },
    { value: 'Femenino',            label: 'Femenino' },
    { value: 'Otro',                label: 'Otro' },
    { value: 'Prefiero no decirlo', label: 'Prefiero no decirlo' },
  ];

  readonly form = this.fb.nonNullable.group({
    nombre:          ['', Validators.required],
    email:           ['', [Validators.required, Validators.email]],
    password:        ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&.]{8,}$/),
    ]],
    confirmPassword: ['', Validators.required],
    sexo:            ['', Validators.required],
    aceptaTerminos:  [false, Validators.requiredTrue],
  }, { validators: passwordMatchValidator });

  readonly showTermsModal = signal(false);

  openTerms(event?: Event): void {
    event?.preventDefault();
    this.showTermsModal.set(true);
  }

  closeTerms(): void {
    this.showTermsModal.set(false);
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.photoError.set(null);

    const photoValidationError = validatePhotoFile(file);

    if (photoValidationError) {
      this.clearSelectedPhoto();
      this.photoError.set(photoValidationError);
      input.value = '';
      return;
    }

    this.clearSelectedPhoto();
    this.selectedPhoto.set(file);
    this.photoObjectUrl = URL.createObjectURL(file);
    this.photoPreview.set(this.photoObjectUrl);
    input.value = '';
  }

  onRemovePhoto(event: Event): void {
    event.stopPropagation();
    this.clearSelectedPhoto();
    this.photoError.set(null);
  }

  private clearSelectedPhoto(): void {
    if (this.photoObjectUrl) {
      URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = null;
    }

    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.globalError.set(null);

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    const { nombre, email, password, sexo } = this.form.getRawValue();

    this.auth.register({
      nombre,
      email,
      password,
      sexo,
      foto: this.selectedPhoto(),
      aceptaTerminos: true,
    }).subscribe({
      next: (response) => {
        this.loading.set(false);

        if (response.isSilentSuccess) {
          this.form.patchValue({
            password: '',
            confirmPassword: '',
          });
          this.globalError.set('Ocurrió un error al procesar el registro. Intentá de nuevo más tarde.');
          return;
        }

        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        returnUrl ? this.router.navigateByUrl(returnUrl) : this.router.navigate(['/crear-hogar']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.globalError.set('Verificá los datos ingresados.');
        } else {
          this.globalError.set('Ocurrió un error. Intentá de nuevo.');
        }
      },
    });
  }

  onLogoClick(): void {
    this.router.navigate(['/']);
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

  stepCircleClass(step: { completed: boolean; active: boolean }): string {
    if (step.completed || step.active) {
      return 'w-8 h-8 rounded-full bg-nido-cream flex items-center justify-center shrink-0';
    }
    return 'w-8 h-8 rounded-full border-2 border-solid border-[rgba(247,241,230,0.35)] flex items-center justify-center shrink-0';
  }

  stepLabelClass(step: { active: boolean }): string {
    return step.active
      ? 'text-[0.65rem] whitespace-nowrap text-nido-cream font-semibold'
      : 'text-[0.65rem] whitespace-nowrap text-[rgba(247,241,230,0.45)]';
  }
}
