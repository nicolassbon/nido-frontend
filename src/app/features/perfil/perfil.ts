import { Component, inject, OnInit, signal } from '@angular/core';
import { StatCard } from '../../shared/ui/stat-card/stat-card';
import { PreferenceCard } from '../../shared/ui/preference-card/preference-card';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink } from '@angular/router';
import { PerfilApiService, PerfilApiResponse } from './perfil-api.service';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, RouterLink, StatCard, PreferenceCard, LucideAngularModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent implements OnInit {
  private readonly perfilApi = inject(PerfilApiService);

  protected readonly usuario = signal<PerfilApiResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly apiError = signal<string | null>(null);

  ngOnInit(): void {
    this.perfilApi.getProfile().subscribe({
      next: (profile) => {
        this.usuario.set(profile);
        this.isLoading.set(false);
      },
      error: () => {
        this.apiError.set('No se pudo cargar la información del perfil. Verificá la conexión.');
        this.isLoading.set(false);
      },
    });
  }
}
