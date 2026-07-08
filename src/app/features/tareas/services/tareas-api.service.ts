import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AsignacionResponse {
  usuarioId: string;
  nombre: string;
  fotoStorageKey: string | null;
}

export interface TareaResponse {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_progreso' | 'completada';
  fechaLimite: string | null;
  fechaCompletado: string | null;
  creadoPor: string;
  creadoPorNombre: string;
  completadoPor: string | null;
  completadoPorNombre: string | null;
  asignadoA: AsignacionResponse | null;
  vencida: boolean;
  createdAt: string;
  xpOtorgado?: number | null;
}

export interface GamificacionProgresoResponse {
  usuarioId: string;
  currentXp: number;
  currentLevel: number;
  currentLevelNombre: string | null;
  nextLevel: number | null;
  nextLevelNombre: string | null;
  nextThresholdXp: number | null;
  xpToNextLevel: number | null;
  hasNextLevel: boolean;
}

export interface MiembroDistribucionResponse {
  usuarioId: string;
  nombre: string;
  completadas: number;
}

export interface DistribucionDiaResponse {
  dia: string;
  fecha: string;
  miembros: MiembroDistribucionResponse[];
}

export interface DistribucionSemanalResponse {
  dias: DistribucionDiaResponse[];
}

export interface CreateTareaRequest {
  titulo: string;
  descripcion: string | null;
  fechaLimite: string | null;
  asignadoA: string | null;
}

export interface UpdateTareaRequest {
  titulo?: string;
  descripcion?: string;
  fechaLimite?: string | null;
  estado?: string;
}

@Injectable({ providedIn: 'root' })
export class TareasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getProgreso(): Observable<GamificacionProgresoResponse> {
    return this.http.get<GamificacionProgresoResponse>(`${this.base}/gamificacion/progreso`);
  }

  getTareas(): Observable<TareaResponse[]> {
    return this.http.get<TareaResponse[]>(`${this.base}/tareas`);
  }

  getMisTareas(): Observable<TareaResponse[]> {
    return this.http.get<TareaResponse[]>(`${this.base}/tareas/mis-tareas`);
  }

  getDistribucionSemanal(): Observable<DistribucionSemanalResponse> {
    return this.http.get<DistribucionSemanalResponse>(`${this.base}/tareas/distribucion-semanal`);
  }

  createTarea(req: CreateTareaRequest): Observable<TareaResponse> {
    return this.http.post<TareaResponse>(`${this.base}/tareas`, req);
  }

  updateTarea(id: string, req: UpdateTareaRequest): Observable<TareaResponse> {
    return this.http.patch<TareaResponse>(`${this.base}/tareas/${id}`, req);
  }

  completarTarea(id: string): Observable<TareaResponse> {
    return this.http.post<TareaResponse>(`${this.base}/tareas/${id}/completar`, {});
  }

  asignarTarea(id: string, usuarioId: string | null): Observable<TareaResponse> {
    return this.http.post<TareaResponse>(`${this.base}/tareas/${id}/asignar`, { usuarioId });
  }

  deleteTarea(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tareas/${id}`);
  }
}
