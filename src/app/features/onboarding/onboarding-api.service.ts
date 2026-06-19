import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RestriccionCatalogo {
  id: string;
  nombre: string;
  tipo: string;
}

export interface MetaCatalogo {
  id: string;
  nombre: string;
}

export interface SaveWellnessRequest {
  skip: boolean;
  usuarioId: string | null;
  hogarId: string | null;
  restriccionIds: string[];
  metaIds: string[];
}

export interface SaveHouseholdRequest {
  skip: boolean;
  usuarioId: string | null;
  hogarId: string | null;
  members: {
    nombre: string;
    rol: string | null;
  }[];
}

//equipamiento
export interface SaveEquipmentRequest {
  skip: boolean;
  usuarioId: string | null;
  hogarId: string | null;
  equipments: {
    catalogoId: string | null;
    nombre: string;
    tipo: string | null;
    estado: string | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getPreferenciasAlimentarias(): Observable<RestriccionCatalogo[]> {
    return this.http.get<RestriccionCatalogo[]>(`${this.base}/onboarding/preferencias-alimentarias`);
  }

  getAlergias(search?: string): Observable<RestriccionCatalogo[]> {
    const params = search ? { q: search } : undefined;
    return this.http.get<RestriccionCatalogo[]>(`${this.base}/onboarding/alergias`, { params });
  }

  getMetas(): Observable<MetaCatalogo[]> {
    return this.http.get<MetaCatalogo[]>(`${this.base}/onboarding/metas`);
  }

  saveHouseholdStep(body: SaveHouseholdRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/onboarding/step-2`, body);
  }

  saveWellnessStep(body: SaveWellnessRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/onboarding/step-4`, body);
  }

  saveEquipmentStep(body: SaveEquipmentRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/onboarding/step-3`, body);
  }

  getWellness(): Observable<{ restriccionIds: string[]; metaIds: string[] }> {
    return this.http.get<{ restriccionIds: string[]; metaIds: string[] }>(`${this.base}/onboarding/wellness`);
  }
}
