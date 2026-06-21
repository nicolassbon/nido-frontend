import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductManualResponse, ProductService } from '../../../core/servicios/agregar-producto.service';
import { ApiReceta, RecipesApiService } from '../../recipes/recipes/services/recipes-api.service';
import { FinanzasApiService } from '../../finanzas/finanzas-api.service';
import { TareasApiService } from '../../tareas/services/tareas-api.service';

export interface DashboardProductoPorVencer {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  diasParaVencer: number;
  vencimientoLabel: string;
}

export interface DashboardRecetaDestacada {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  disponibilidadPorcentaje: number;
}

export interface DashboardResponse {
  alacena: {
    productosEnStock: number;
    productosPorVencerEstaSemana: number;
    productosPorVencer: DashboardProductoPorVencer[];
  };
  recetas: {
    recetasGuardadas: number;
    recetasSugeridas: number;
    recetasCocinadas: number;
    destacadas: DashboardRecetaDestacada[];
  };
  finanzas: {
    gastoMensual: number;
    presupuestoRestante: number | null;
  };
  tareas: {
    tareasPendientes: number;
    tareasCompletadas: number;
  };
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly productService = inject(ProductService);
  private readonly recipesApi = inject(RecipesApiService);
  private readonly finanzasApi = inject(FinanzasApiService);
  private readonly tareasApi = inject(TareasApiService);

  getSummary(): Observable<DashboardResponse> {
    return forkJoin({
      stock: this.productService.getProductManual().pipe(catchError(() => of([] as ProductManualResponse[]))),
      recetas: this.recipesApi.getAll().pipe(catchError(() => of([] as ApiReceta[]))),
      presupuesto: this.finanzasApi.getPresupuesto().pipe(catchError(() => of({ monto: null, gastoActual: 0, restante: null, anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 }))),
      tareas: this.tareasApi.getTareas().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ stock, recetas, presupuesto, tareas }) => ({
        alacena: this.buildAlacena(stock),
        recetas: this.buildRecetas(recetas),
        finanzas: {
          gastoMensual: presupuesto.gastoActual,
          presupuestoRestante: presupuesto.restante,
        },
        tareas: {
          tareasPendientes: tareas.filter(t => t.estado !== 'completada').length,
          tareasCompletadas: tareas.filter(t => t.estado === 'completada').length,
        },
      }))
    );
  }

  private buildAlacena(stock: ProductManualResponse[]): DashboardResponse['alacena'] {
    const productosPorVencer = stock
      .map(item => ({ item, dias: this.daysUntil(item.fechaVencimiento) }))
      .filter((entry): entry is { item: ProductManualResponse; dias: number } =>
        entry.dias !== null && entry.dias >= 0 && entry.dias <= 7
      )
      .sort((a, b) => a.dias - b.dias || a.item.nombre.localeCompare(b.item.nombre));

    return {
      productosEnStock: stock.filter(item => item.cantidad > 0).length,
      productosPorVencerEstaSemana: productosPorVencer.length,
      productosPorVencer: productosPorVencer.slice(0, 3).map(({ item, dias }) => ({
        id: item.stockHogarId,
        nombre: item.nombre,
        imagenUrl: item.iconoSvg ? `/assets/icons/categorias/${item.iconoSvg}` : item.imagenUrl,
        diasParaVencer: dias,
        vencimientoLabel: this.expirationLabel(dias),
      })),
    };
  }

  private buildRecetas(recetas: ApiReceta[]): DashboardResponse['recetas'] {
    const recetasConDisponibilidad = recetas
      .map(receta => ({
        receta,
        disponibilidad: this.availabilityPercent(receta),
      }))
      .sort((a, b) => b.disponibilidad - a.disponibilidad || a.receta.nombre.localeCompare(b.receta.nombre));

    return {
      recetasSugeridas: recetas.length,
      recetasGuardadas: recetas.filter(r => r.guardada).length,
      recetasCocinadas: recetas.filter(r => (r.vecesCocinada ?? 0) > 0).length,
      destacadas: recetasConDisponibilidad.slice(0, 3).map(({ receta, disponibilidad }) => ({
        id: receta.id,
        nombre: receta.nombre,
        imagenUrl: receta.imagenUrl,
        disponibilidadPorcentaje: disponibilidad,
      })),
    };
  }

  private availabilityPercent(receta: ApiReceta): number {
    if (receta.ingredientes.length === 0) {
      return 0;
    }

    const inStock = receta.ingredientes.filter(ingrediente => ingrediente.enStock).length;
    return Math.round((inStock / receta.ingredientes.length) * 100);
  }

  private daysUntil(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const expiration = new Date(`${value}T00:00:00`);
    if (Number.isNaN(expiration.getTime())) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((expiration.getTime() - today.getTime()) / 86_400_000);
  }

  private expirationLabel(days: number): string {
    if (days === 0) return 'hoy';
    if (days === 1) return '1 dia';
    return `${days} dias`;
  }
}
