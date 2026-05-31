import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PerfilApiResponse {
  nombre: string;
  email: string;
  telefono: string;
  sexo: 'Femenino' | 'Masculino' | 'Otro' | string;
  fechaRegistro?: string;
  nivel?: string;
  alergias?: string[];
  noMeGusta?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class PerfilApiService {
  private readonly endpoint = `${environment.apiBaseUrl}/api/usuarios/me`;

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<PerfilApiResponse> {
    return this.http.get<PerfilApiResponse>(this.endpoint);
  }

  updateProfile(payload: Partial<PerfilApiResponse>): Observable<PerfilApiResponse> {
    return this.http.put<PerfilApiResponse>(this.endpoint, payload);
  }
}
