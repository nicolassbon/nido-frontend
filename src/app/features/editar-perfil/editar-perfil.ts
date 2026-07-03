import {
  Component,
  inject,
  OnInit,
  signal,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PerfilApiService } from '../perfil/perfil-api.service';
import { validatePhotoFile } from '../../shared/validators/photo';
import { Avatar } from '../../shared/ui/avatar/avatar';

@Component({
  selector: 'app-editar-perfil',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, Avatar],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.scss',
})
export class EditarPerfil implements OnInit {
  /** true cuando se usa embebido como modal dentro de perfil */
  @Input() isModal = false;
  /** Emite al guardar o cancelar (con true si hubo cambios guardados) */
  @Output() closed = new EventEmitter<boolean>();

  private readonly perfilApi = inject(PerfilApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private photoObjectUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearSelectedPhoto();
      if (this.isModal) document.body.style.overflow = '';
    });
  }

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    telefono: [''],
    sexo: ['', Validators.required],
  });

  protected readonly apiError = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly fotoUrl = signal<string | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly removeFoto = signal(false);
  protected readonly photoError = signal<string | null>(null);

  ngOnInit(): void {
    if (this.isModal) document.body.style.overflow = 'hidden';
    this.loadProfile();
  }

  private loadProfile(): void {
    this.apiError.set(null);
    this.isLoading.set(true);

    this.perfilApi.getProfile().subscribe({
      next: (profile) => {
        this.form.patchValue({
          nombre: profile.nombre ?? '',
          telefono: profile.telefono ?? '',
          sexo: profile.sexo ?? 'Otro',
        });
        this.fotoUrl.set(profile.fotoUrl ?? null);
        this.removeFoto.set(false);
        this.isLoading.set(false);
      },
      error: () => {
        this.apiError.set('No se pudieron cargar los datos del perfil.');
        this.isLoading.set(false);
      },
    });
  }

  protected onPhotoSelected(event: Event): void {
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
    this.removeFoto.set(false);
    this.selectedPhoto.set(file);
    this.photoObjectUrl = URL.createObjectURL(file);
    this.photoPreview.set(this.photoObjectUrl);
    input.value = '';
  }

  protected onRemovePhoto(event: Event): void {
    event.stopPropagation();
    this.clearSelectedPhoto();
    this.fotoUrl.set(null);
    this.removeFoto.set(true);
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

  protected onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.apiError.set(null);
    this.isSaving.set(true);

    const { nombre, sexo, telefono } = this.form.getRawValue();

    this.perfilApi
      .updateProfile(nombre, sexo, telefono, this.selectedPhoto(), this.removeFoto())
      .subscribe({
        next: () => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.router.navigate(['/perfil']);
          }
        },
        error: () => {
          this.apiError.set(
            'No se pudo guardar los cambios en el perfil. Intentá nuevamente más tarde.',
          );
          this.isSaving.set(false);
        },
      });
  }

  protected onCancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.router.navigate(['/perfil']);
    }
  }
}
