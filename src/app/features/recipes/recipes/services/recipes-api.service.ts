import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface ApiRecetaIngrediente {
  id: string;
  productoId: string;
  nombre: string;
  productoNombre: string;
  cantidad: number | null;
  unidad: string | null;
  enStock: boolean;
  alergenos?: string[];
}

export interface ApiRecetaPaso {
  id: string;
  orden: number;
  descripcion: string;
}

export interface ApiRecetaElectrodomestico {
  id: string;
  tipoRequerido: string | null;
}

export interface ApiRecetaProductoPorVencer {
  productoId: string;
  nombre: string;
  fechaVencimiento: string;
  diasHastaVencimiento: number;
}

export interface ApiReceta {
  id: string;
  nombre: string;
  descripcion: string | null;
  tiempoCoccionMin: number | null;
  dificultad: string | null;
  porciones: number | null;
  fuenteId: string | null;
  imagenUrl: string | null;
  calorias: number | null;
  proteinas: number | null;
  carbohidratos: number | null;
  grasas: number | null;
  ingredientes: ApiRecetaIngrediente[];
  pasos?: ApiRecetaPaso[];
  electrodomesticos?: ApiRecetaElectrodomestico[];
  // Agregado cuando el backend implemente el contador (US-14)
  vecesCocinada?: number;
  tieneProductosPorVencer?: boolean;
  fechaVencimientoMasProxima?: string | null;
  diasHastaVencimiento?: number | null;
  productosPorVencer?: ApiRecetaProductoPorVencer[];
  guardada?: boolean;
}

export interface CocinarRecetaResponse {
  recetaId: string;
  vecesCocinada: number;
}

@Injectable({
  providedIn: 'root',
})
export class RecipesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getAll(): Observable<ApiReceta[]> {
    return this.http.get<ApiReceta[]>(`${this.base}/recetas`);
  }

  getById(id: string): Observable<ApiReceta> {
    return this.http.get<ApiReceta>(`${this.base}/recetas/${id}`);
  }

  /** POST /recetas/{id}/cocinar — endpoint a implementar por el backend (US-14) */
  cocinar(id: string): Observable<CocinarRecetaResponse> {
    return this.http.post<CocinarRecetaResponse>(`${this.base}/recetas/${id}/cocinar`, {});
  }

  getSaved(): Observable<ApiReceta[]> {
    return this.http.get<ApiReceta[]>(`${this.base}/recetas/guardadas`);
  }

  save(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/recetas/${id}/guardar`, {});
  }

  unsave(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recetas/${id}/guardar`);
  }
}
