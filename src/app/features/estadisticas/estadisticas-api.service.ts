import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PrioridadReposicion = 'urgente' | 'pronto' | 'normal' | 'ninguna';

export interface ProductoConsumoResponse {
  stockId:                       string;
  productoId:                    string;
  nombre:                        string;
  categoriaNombre:               string | null;
  ubicacion:                     string | null;
  cantidadActual:                number;
  unidadMedida:                  string | null;
  estaAbierto:                   boolean;
  porcentajeConsumido:           number;
  fechaVencimiento:              string | null;
  diasHastaVencimiento:          number | null;
  tasaConsumoDiariaEstimada:     number | null;
  diasHastaAgotamientoEstimado:  number | null;
  prioridadReposicion:           PrioridadReposicion;
}

export interface EstadisticasConsumoResponse {
  total:            number;
  totalAbiertos:    number;
  totalPorVencer:   number;
  totalParaReponer: number;
  items:            ProductoConsumoResponse[];
}

@Injectable({ providedIn: 'root' })
export class EstadisticasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getConsumo(): Observable<EstadisticasConsumoResponse> {
    return this.http.get<EstadisticasConsumoResponse>(`${this.base}/estadisticas/consumo`);
  }
}
