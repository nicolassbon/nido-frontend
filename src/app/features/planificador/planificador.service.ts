import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PlanificadorItemDto {
  id:          string;
  fecha:       string; // yyyy-MM-dd
  tipoComida:  string;
  recetaId:    string | null;
  recetaNombre: string | null;
  imagenUrl:   string | null;
  tituloLibre: string | null;
  hora:        string | null;
  orden:       number;
  creadoPor:   string;
}

export interface PlanificadorSemanaDto {
  id:          string;
  fechaInicio: string; // yyyy-MM-dd
  items:       PlanificadorItemDto[];
}

export interface AddItemRequest {
  fecha:       string;
  tipoComida:  string;
  recetaId?:   string | null;
  tituloLibre?: string | null;
  hora?:       string | null;
}

export interface UpdateItemRequest {
  recetaId?:    string | null;
  tituloLibre?: string | null;
  hora?:        string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanificadorService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getSemana(fechaInicio: string): Observable<PlanificadorSemanaDto> {
    return this.http.get<PlanificadorSemanaDto>(
      `${this.base}/planificador?fechaInicio=${fechaInicio}`
    );
  }

  addItem(request: AddItemRequest): Observable<PlanificadorItemDto> {
    return this.http.post<PlanificadorItemDto>(
      `${this.base}/planificador/items`, request
    );
  }

  updateItem(id: string, request: UpdateItemRequest): Observable<PlanificadorItemDto> {
    return this.http.patch<PlanificadorItemDto>(
      `${this.base}/planificador/items/${id}`, request
    );
  }

  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/planificador/items/${id}`);
  }

  /** Devuelve el lunes de la semana que contiene la fecha dada */
  static getLunes(date: Date): Date {
    const d = new Date(date);
    const dow = d.getDay(); // 0=Sun, 1=Mon...
    const offset = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Formatea Date → 'yyyy-MM-dd' */
  static toIso(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /** Etiqueta amigable de día */
  static diaLabel(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
  }
}
