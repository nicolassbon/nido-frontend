import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EstadisticasApiService, ProductoConsumoResponse, PrioridadReposicion } from './estadisticas-api.service';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estadisticas.html',
  styleUrls: [],
})
export class Estadisticas implements OnInit {
  private readonly api = inject(EstadisticasApiService);

  protected readonly loading      = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly items        = signal<ProductoConsumoResponse[]>([]);
  protected readonly total            = signal(0);
  protected readonly totalAbiertos    = signal(0);
  protected readonly totalPorVencer   = signal(0);
  protected readonly totalParaReponer = signal(0);

  protected readonly filtro = signal<'todos' | 'urgentes' | 'abiertos' | 'porVencer'>('todos');

  protected readonly filtered = computed(() => {
    const items = this.items();
    switch (this.filtro()) {
      case 'urgentes':
        return items
          .filter(i => i.prioridadReposicion === 'urgente' || i.prioridadReposicion === 'pronto')
          .sort((a, b) => prioridadOrden(a.prioridadReposicion) - prioridadOrden(b.prioridadReposicion));
      case 'abiertos':
        return items.filter(i => i.estaAbierto);
      case 'porVencer':
        return items
          .filter(i => i.diasHastaVencimiento !== null && i.diasHastaVencimiento >= 0 && i.diasHastaVencimiento <= 7)
          .sort((a, b) => (a.diasHastaVencimiento ?? 99) - (b.diasHastaVencimiento ?? 99));
      default:
        return items.sort((a, b) => prioridadOrden(a.prioridadReposicion) - prioridadOrden(b.prioridadReposicion));
    }
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.getConsumo().subscribe({
      next: res => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.totalAbiertos.set(res.totalAbiertos);
        this.totalPorVencer.set(res.totalPorVencer);
        this.totalParaReponer.set(res.totalParaReponer);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las estadísticas.');
        this.loading.set(false);
      },
    });
  }

  protected formatAmount(value: number, unit: string | null): string {
    const u = (unit ?? 'unidad').trim().toLowerCase();
    const labels: Record<string, string> = { gr: 'g', kg: 'kg', ml: 'ml', lt: 'l' };
    const suffix = labels[u] ?? u;
    if (u === 'unidad' || !suffix) return `${value}`;
    const sep = (suffix === 'cda' || suffix === 'cdita') ? ' ' : '';
    return `${value}${sep}${suffix}`;
  }

  protected prioridadLabel(p: PrioridadReposicion): string {
    return p === 'urgente' ? 'Comprar urgente'
         : p === 'pronto'  ? 'Comprar pronto'
         : p === 'normal'  ? 'Tener en cuenta'
                           : 'Sin urgencia';
  }

  protected prioridadColor(p: PrioridadReposicion): string {
    return p === 'urgente' ? '#b44c3c'
         : p === 'pronto'  ? '#d97706'
         : p === 'normal'  ? '#927357'
                           : '#9a806c';
  }
}

function prioridadOrden(p: PrioridadReposicion): number {
  return p === 'urgente' ? 0 : p === 'pronto' ? 1 : p === 'normal' ? 2 : 3;
}
