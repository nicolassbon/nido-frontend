import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface NotificacionResponse {
  id: string;
  usuarioId: string;
  tipo: string | null;
  mensaje: string | null;
  leida: boolean;
  referenciaId: string | null;
  referenciaTipo: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getNotificaciones(): Observable<NotificacionResponse[]> {
    return this.http.get<NotificacionResponse[]>(`${this.base}/notificaciones`);
  }

  marcarComoLeida(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notificaciones/${id}/leer`, {});
  }

  marcarTodasComoLeidas(): Observable<void> {
    return this.http.post<void>(`${this.base}/notificaciones/leer-todas`, {});
  }

  eliminarNotificacion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/notificaciones/${id}`);
  }
}
