import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Electrodomestico {
  id: string;
  hogarId: string;
  nombre: string;
  tipo: string | null;
  estado: string | null;
  imagenUrl: string | null;
}

export interface CrearElectrodomesticoRequest {
  hogarId: string;
  nombre: string;
  tipo?: string | null;
  estado?: string | null;
  marca?: string | null;
  imagenUrl?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ElectrodomesticosService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getAll(): Observable<Electrodomestico[]> {
    return this.http.get<Electrodomestico[]>(`${this.apiBaseUrl}/electrodomesticos`);
  }

  add(body: CrearElectrodomesticoRequest): Observable<Electrodomestico> {
    return this.http.post<Electrodomestico>(`${this.apiBaseUrl}/electrodomesticos`, body);
  }
}
