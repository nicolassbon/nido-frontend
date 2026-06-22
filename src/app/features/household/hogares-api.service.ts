import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MiembroResponse {
  usuarioId: string;
  nombre:    string;
  email:     string;
  rol:       string;
  fotoUrl:   string | null;
  alergias:  string[];
}

export interface AceptarInvitacionResponse {
  hogarId:     string;
  hogarNombre: string;
  accessToken: string;
}

export interface CrearHogarResponse {
  hogarId:     string;
  hogarNombre: string;
  accessToken: string;
}

export interface HogarResponse {
  id:     string;
  nombre: string;
}

export interface HogarResumenResponse {
  id:     string;
  nombre: string;
  rol:    string;
}

export interface CambiarHogarResponse {
  hogarId:     string;
  hogarNombre: string;
  accessToken: string;
}

export interface InvitacionPreviewResponse {
  hogarNombre:   string;
  emailInvitado: string | null;
  expiraEn:      string | null;
}

export interface HogarResponse {
  id:     string;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class HogaresApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getMiembros(): Observable<MiembroResponse[]> {
    return this.http.get<MiembroResponse[]>(`${this.base}/hogares/miembros`);
  }

  invitar(emailInvitado: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/hogares/invitar`, { emailInvitado });
  }

  getInvitacionPreview(token: string): Observable<InvitacionPreviewResponse> {
    return this.http.get<InvitacionPreviewResponse>(`${this.base}/hogares/invitaciones/${token}`);
  }

  removeMiembro(usuarioId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hogares/miembros/${usuarioId}`);
  }

  aceptarInvitacion(token: string): Observable<AceptarInvitacionResponse> {
    return this.http.post<AceptarInvitacionResponse>(
      `${this.base}/hogares/aceptar-invitacion`,
      { token },
    );
  }

  /** Devuelve el hogar actual del usuario autenticado. */
  getHogar(): Observable<HogarResponse> {
    return this.http.get<HogarResponse>(`${this.base}/hogares`);
  }

  /** Actualiza el nombre del hogar actual. Solo el owner puede hacerlo. */
  updateHogarNombre(nombre: string): Observable<HogarResponse> {
    return this.http.patch<HogarResponse>(`${this.base}/hogares`, { nombre });
  }

  crearHogar(nombre: string): Observable<CrearHogarResponse> {
    return this.http.post<CrearHogarResponse>(`${this.base}/hogares`, { nombre });
  }

  getMisHogares(): Observable<HogarResumenResponse[]> {
    return this.http.get<HogarResumenResponse[]>(`${this.base}/hogares/mis-hogares`);
  }

  activarHogar(hogarId: string): Observable<CambiarHogarResponse> {
    return this.http.post<CambiarHogarResponse>(`${this.base}/hogares/${hogarId}/activar`, {});
  }

  renombrarHogar(hogarId: string, nombre: string): Observable<HogarResponse> {
    return this.http.patch<HogarResponse>(`${this.base}/hogares/${hogarId}`, { nombre });
  }

  eliminarHogar(hogarId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hogares/${hogarId}`);
  }
}
