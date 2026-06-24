import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardApiService, DashboardResponse } from './dashboard-api.service';
import { InsightsPanel } from '../insights/insights-panel';

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideAngularModule, InsightsPanel],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardApi = inject(DashboardApiService);

  protected readonly greeting = signal(this.buildGreeting());
  protected readonly userName = signal(this.authService.getNombre() ?? 'vos');
  protected readonly today = signal(this.toTitleCase(
    new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  ));

  protected readonly dashboard = signal<DashboardResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly expiringProducts = computed(() =>
    this.dashboard()?.alacena.productosPorVencer ?? []
  );

  protected readonly featuredRecipes = computed(() =>
    this.dashboard()?.recetas.destacadas ?? []
  );

  ngOnInit(): void {
    this.dashboardApi.getSummary().subscribe({
      next: dashboard => {
        this.dashboard.set(this.withResolvedImages(dashboard));
        this.isLoading.set(false);
      },
      error: error => {
        console.error('Error cargando dashboard', error);
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos Dias';
    if (hour < 19) return 'Buenas Tardes';
    return 'Buenas Noches';
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private withResolvedImages(dashboard: DashboardResponse): DashboardResponse {
    return {
      ...dashboard,
      alacena: {
        ...dashboard.alacena,
        productosPorVencer: dashboard.alacena.productosPorVencer.map(product => ({
          ...product,
          imagenUrl: this.resolveImageUrl(product.imagenUrl),
        })),
      },
      recetas: {
        ...dashboard.recetas,
        destacadas: dashboard.recetas.destacadas.map(recipe => ({
          ...recipe,
          imagenUrl: this.resolveImageUrl(recipe.imagenUrl),
        })),
      },
    };
  }

  private resolveImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url;
    if (url.startsWith('/productos/') || url.startsWith('/assets/')) return url;
    const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }

  private toTitleCase(value: string): string {
    return value.replace(/\p{L}+/gu, word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }
}
