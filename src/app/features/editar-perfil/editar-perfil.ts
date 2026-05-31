import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PerfilApiService } from '../perfil/perfil-api.service';

@Component({
  selector: 'app-editar-perfil',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.scss',
})
export class EditarPerfil implements OnInit {
  private readonly perfilApi = inject(PerfilApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    sexo: ['Femenino', Validators.required],
  });

  protected readonly apiError = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);

  ngOnInit(): void {
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
        this.isLoading.set(false);
      },
      error: () => {
        this.apiError.set('No se pudieron cargar los datos del perfil.');
        this.isLoading.set(false);
      },
    });
  }

  protected onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.apiError.set(null);
    this.isSaving.set(true);

    this.perfilApi.updateProfile(this.form.value).subscribe({
      next: () => this.router.navigate(['/perfil']),
      error: () => {
        this.apiError.set('No se pudo guardar los cambios en el perfil. Intentá nuevamente más tarde.');
        this.isSaving.set(false);
      },
    });
  }

  protected onCancel(): void {
    this.router.navigate(['/perfil']);
  }
}
