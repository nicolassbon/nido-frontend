import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { validatePhotoFile } from '../../../shared/validators/photo';
import { NidoSelectComponent, NidoSelectOption } from '../../../shared/ui/form/nido-select/nido-select';

export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, LucideAngularModule, NidoSelectComponent],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private photoObjectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearSelectedPhoto());
  }

  readonly steps = [
    { number: 1, label: 'Tu cuenta',    completed: false, active: true  },
    { number: 2, label: 'Tu hogar',     completed: false, active: false },
    { number: 3, label: 'Equipamiento', completed: false, active: false },
    { number: 4, label: 'Finalizar',    completed: false, active: false },
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
  }, { validators: passwordMatchValidator });

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
    }).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        returnUrl ? this.router.navigateByUrl(returnUrl) : this.router.navigate(['/crear-hogar']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.globalError.set('Este email ya está registrado.');
        } else if (err.status === 400) {
          this.globalError.set('Verificá los datos ingresados.');
        } else {
          this.globalError.set('Ocurrió un error. Intentá de nuevo.');
        }
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
