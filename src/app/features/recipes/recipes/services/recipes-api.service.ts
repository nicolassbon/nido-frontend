import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface ApiRecetaIngrediente {
  id: string;
  productoId: string | null;
  nombre: string;
  productoNombre: string | null;
  cantidad: number | null;
  unidad: string | null;
  cantidadCompraEstandar?: number | null;
  unidadCompraEstandar?: string | null;
  cantidadListaCompras?: number | null;
  unidadListaCompras?: string | null;
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
  /** Promedio de calificación (1-5, redondeado a 1 decimal). 0 si nadie calificó. */
  calificacionPromedio?: number;
  /** Cantidad de reseñas. */
  calificacionTotal?: number;
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

export interface ApiResena {
  id:             string;
  recetaId:       string;
  usuarioId:      string;
  usuarioNombre:  string;
  usuarioFotoUrl: string | null;
  puntuacion:     number;
  comentario:     string | null;
  createdAt:      string;
  updatedAt:      string | null;
}

export interface ApiResenasReceta {
  items:    ApiResena[];
  promedio: number;
  total:    number;
  miResena: ApiResena | null;
}

export interface ApiNota {
  id:             string;
  recetaId:       string;
  hogarId:        string;
  usuarioId:      string;
  usuarioNombre:  string;
  usuarioFotoUrl: string | null;
  texto:          string;
  createdAt:      string;
}

export interface ApiNotasReceta {
  items: ApiNota[];
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

  recomendarPorIa(busqueda: string, objetivo: string, restricciones: string[] = []): Observable<ApiReceta[]> {
    const params = new HttpParams()
      .set('busqueda', busqueda)
      .set('objetivo', objetivo)
      .set('restricciones', restricciones.join(','));

    return this.http.get<ApiReceta[]>(`${this.base}/recetas/ia/recomendar`, { params });
  }

  // ── Reseñas ──────────────────────────────────────────────
  getResenas(recetaId: string): Observable<ApiResenasReceta> {
    return this.http.get<ApiResenasReceta>(`${this.base}/recetas/${recetaId}/resenas`);
  }

  /** Crea o actualiza la reseña del usuario para la receta. */
  upsertResena(recetaId: string, puntuacion: number, comentario: string | null): Observable<ApiResena> {
    return this.http.put<ApiResena>(`${this.base}/recetas/${recetaId}/resenas`, { puntuacion, comentario });
  }

  deleteResena(recetaId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recetas/${recetaId}/resenas`);
  }

  // ── Notas del hogar ──────────────────────────────────────
  getNotas(recetaId: string): Observable<ApiNotasReceta> {
    return this.http.get<ApiNotasReceta>(`${this.base}/recetas/${recetaId}/notas`);
  }

  addNota(recetaId: string, texto: string): Observable<ApiNota> {
    return this.http.post<ApiNota>(`${this.base}/recetas/${recetaId}/notas`, { texto });
  }

  deleteNota(recetaId: string, notaId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recetas/${recetaId}/notas/${notaId}`);
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
