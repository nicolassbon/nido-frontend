import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { InsightsApiService, InsightsHogarResponse } from './insights-api.service';

interface DonutSlice {
  label: string;
  count: number;
  color: string;
  startAngle: number;
  endAngle: number;
  pathD: string;
}

interface RecetaTopBar {
  nombre: string;
  veces: number;
  porcentaje: number;
}

/**
 * Panel principal de recomendaciones inteligentes en el Inicio.
 *
 * Tres bloques:
 *  - Métricas globales del hogar (chips arriba)
 *  - 4 cards de acción (Comprá pronto, Por vencer, Desperdicio, Envases olvidados)
 *  - Bloque visual: clasificación de productos (donut) + recetas top + ingredientes top
 */
@Component({
  selector: 'app-insights-panel',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights-panel.html',
})
export class InsightsPanel implements OnInit {
  private readonly api = inject(InsightsApiService);

  protected readonly data = signal<InsightsHogarResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly donutSlices = computed<DonutSlice[]>(() => {
    const d = this.data();
    if (!d) return [];

    const groups = [
      { label: 'Esencial',   count: d.clasificacion.esenciales.length,   color: 'var(--color-nido-green,#3e5e4a)' },
      { label: 'Recurrente', count: d.clasificacion.recurrentes.length,  color: '#4f8062' },
      { label: 'Ocasional',  count: d.clasificacion.ocasionales.length,  color: '#c9a87c' },
      { label: 'Caprichoso', count: d.clasificacion.caprichosos.length,  color: '#c45f4f' },
    ];

    const total = groups.reduce((acc, g) => acc + g.count, 0);
    if (total === 0) return [];

    let angle = -Math.PI / 2;
    return groups.map(g => {
      const span = (g.count / total) * Math.PI * 2;
      const start = angle;
      const end = angle + span;
      angle = end;
      return { ...g, startAngle: start, endAngle: end, pathD: this.arcPath(start, end, g.count === total) };
    }).filter(s => s.count > 0);
  });

  protected readonly recetasTopBars = computed<RecetaTopBar[]>(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(...d.patrones.recetasTop.map(r => r.vecesCocinada), 1);
    return d.patrones.recetasTop.map(r => ({
      nombre: r.nombre,
      veces: r.vecesCocinada,
      porcentaje: Math.round((r.vecesCocinada / max) * 100),
    }));
  });

  protected readonly desperdicioDelta = computed<{ direction: 'up'|'down'|'flat'; absDiff: number } | null>(() => {
    const d = this.data();
    if (!d) return null;
    const actual = d.resumen.tasaDesperdicioPorc;
    const prev = d.resumen.tasaDesperdicioMesAnteriorPorc;
    const diff = Number((actual - prev).toFixed(1));
    if (diff === 0 || prev === 0) return { direction: 'flat', absDiff: 0 };
    return diff > 0
      ? { direction: 'up', absDiff: Math.abs(diff) }
      : { direction: 'down', absDiff: Math.abs(diff) };
  });

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

  protected etiquetaVence(dias: number): string {
    if (dias <= 0) return 'vence hoy';
    if (dias === 1) return 'vence mañana';
    return `vence en ${dias} días`;
  }

  protected etiquetaAgotar(dias: number): string {
    if (dias <= 0) return 'sin stock pronto';
    if (dias === 1) return '~1 día';
    return `~${dias} días`;
  }

  protected colorCategoria(c: string): string {
    switch (c) {
      case 'Esencial':   return 'bg-nido-green/15 text-nido-green-dark border-nido-green/30';
      case 'Recurrente': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Ocasional':  return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Caprichoso': return 'bg-red-50 text-red-700 border-red-200';
      default:           return 'bg-nido-cream text-nido-brown border-nido-border/50';
    }
  }

  protected etiquetaFrecuencia(d: number): string {
    if (d <= 0) return 'sin datos';
    if (d === 1) return 'todos los días';
    if (d <= 8) return `cada ${d} días`;
    if (d <= 16) return 'cada ~2 semanas';
    if (d <= 24) return 'cada ~3 semanas';
    return 'cada mes';
  }

  private arcPath(startAngle: number, endAngle: number, full: boolean): string {
    const cx = 60, cy = 60, r = 52;
    if (full) {
      // Círculo completo (dos arcos)
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
    }
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }
}
