import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PerfilApiResponse {
  nombre: string;
  email: string;
  telefono: string;
  sexo: 'Femenino' | 'Masculino' | 'Otro' | string;
  fotoStorageKey?: string;
  fotoUrl?: string;
  fechaRegistro?: string;
  nivel?: string;
  alergias?: string[];
  alimentacion?: string[];
  hasPassword?: boolean;
  hasGoogleLinked?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PerfilApiService {
  private readonly endpoint = `${environment.apiBaseUrl}/perfiles`;
  private readonly http = inject(HttpClient);

  getProfile(): Observable<PerfilApiResponse> {
    return this.http.get<PerfilApiResponse>(this.endpoint);
  }

  updateProfile(nombre: string, sexo: string, telefono: string, foto: File | null): Observable<PerfilApiResponse> {
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('sexo', sexo);
    if (telefono) {
      formData.append('telefono', telefono);
    }
    if (foto) {
      formData.append('foto', foto);
    }
    return this.http.put<PerfilApiResponse>(this.endpoint, formData);
  }

  updateRestricciones(tipo: string, restriccionIds: string[]): Observable<any> {
    return this.http.put(`${this.endpoint}/restricciones`, { tipo, restriccionIds });
  }
}
