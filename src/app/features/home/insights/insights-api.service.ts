import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ComprarProntoItem {
  productoNombre: string;
  stockActual: number;
  unidadMedida: string | null;
  diasParaAgotar: number;
  tasaDiariaPromedio: number;
}

export interface PorVencerItem {
  stockHogarId: string;
  productoNombre: string;
  imagen: string | null;
  cantidad: number;
  unidadMedida: string | null;
  fechaVencimiento: string;
  diasParaVencer: number;
}

export interface DesperdicioItem {
  productoNombre: string;
  vecesVencido: number;
  vecesCocinado: number;
  sugerencia: string;
}

export interface ResumenInsights {
  totalProductosAlacena: number;
  productosPorVencerSemana: number;
  consumosUltimos30Dias: number;
  tasaDesperdicioPorc: number;
}

export interface InsightsHogarResponse {
  comprarPronto: ComprarProntoItem[];
  porVencer: PorVencerItem[];
  desperdicios: DesperdicioItem[];
  resumen: ResumenInsights;
}

@Injectable({ providedIn: 'root' })
export class InsightsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/insights`;

  getForHogar(): Observable<InsightsHogarResponse> {
    return this.http.get<InsightsHogarResponse>(`${this.baseUrl}/hogar`);
  }
}
