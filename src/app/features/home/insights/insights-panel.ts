import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { InsightsApiService, InsightsHogarResponse } from './insights-api.service';

/**
 * Panel de recomendaciones inteligentes basado en el motor de insights del backend.
 * Aparece dentro del Inicio (no es una sección separada).
 */
@Component({
  selector: 'app-insights-panel',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights-panel.html',
})
export class InsightsPanel implements OnInit {
  private readonly api = inject(InsightsApiService);

  protected readonly data = signal<InsightsHogarResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    this.api.getForHogar().subscribe({
      next: response => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected formatDias(d: number): string {
    if (d <= 0) return 'hoy';
    if (d < 1) return 'hoy';
    if (d === 1) return '1 día';
    return `${Math.round(d)} días`;
  }

  protected etiquetaVence(dias: number): string {
    if (dias <= 0) return 'vence hoy';
    if (dias === 1) return 'vence mañana';
    return `vence en ${dias} días`;
  }
}
