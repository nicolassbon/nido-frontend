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
}

export interface AceptarInvitacionResponse {
  hogarId:     string;
  hogarNombre: string;
  accessToken: string;
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

  aceptarInvitacion(token: string): Observable<AceptarInvitacionResponse> {
    return this.http.post<AceptarInvitacionResponse>(
      `${this.base}/hogares/aceptar-invitacion`,
      { token },
    );
  }
}
