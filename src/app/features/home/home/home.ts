import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardApiService, DashboardResponse } from './dashboard-api.service';
import { StatCard } from '../../../shared/ui/stat-card/stat-card';
import { InsightsPanel } from '../insights/insights-panel';

interface QuickAction {
  label: string;
  icon: string;
  route: string;
  classes: string;
  iconBgClass: string;
  chipClass: string;
}

@Component({
  selector: 'app-home',
  imports: [NgClass, RouterLink,StatCard, LucideAngularModule, InsightsPanel],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardApi = inject(DashboardApiService);

  protected readonly greeting = signal(this.buildGreeting());
  protected readonly userName = signal(this.authService.getNombre() ?? 'vos');
  protected readonly today = signal(

    new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).toUpperCase()

  );

  private capitalizeFirstLetter(val: string): string {
    if (!val) return val;
    return val.charAt(0).toUpperCase() + val.slice(1);
  }

  protected readonly quickActions: QuickAction[] = [
    {
      label: 'Agregar a la alacena',
      icon: 'shopping-basket',
      route: '/agregar-producto',
      classes: 'flex items-center justify-center gap-6 rounded-[8px] min-h-[72px] px-5 text-nido-cream no-underline text-[1rem] font-medium leading-none shadow-[0_3px_10px_rgba(38,63,48,0.08)] bg-nido-green-dark hover:bg-nido-green hover:-translate-y-0.5 transition-transform',
      iconBgClass: 'bg-transparent',
      chipClass: 'bg-nido-green-dark text-nido-cream hover:bg-nido-green',
    },
    {
      label: 'Explorar recetas',
      icon: 'chef-hat',
      route: '/recetas',
      classes: 'flex items-center justify-center gap-6 rounded-[8px] min-h-[72px] px-5 text-nido-cream no-underline text-[1rem] font-medium leading-none shadow-[0_3px_10px_rgba(38,63,48,0.08)] bg-nido-brown hover:bg-nido-gold hover:-translate-y-0.5 transition-transform',
      iconBgClass: 'bg-transparent',
      chipClass: 'bg-nido-brown text-nido-cream hover:bg-nido-gold',
    },
  ];

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
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  private withResolvedImages(dashboard: DashboardResponse): DashboardResponse {
    return {
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
      finanzas: dashboard.finanzas,
      tareas: dashboard.tareas,
    };
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private resolveImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url;
    if (url.startsWith('/productos/')) return url;
    const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }
}
