import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ComprarProntoItem {
  productoNombre: string;
  stockActual: number;
  unidadMedida: string | null;
  diasParaAgotar: number;
  frecuenciaCompraDias: number;
  categoria: string;
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
  tasaDesperdicioPorc: number;
  sugerencia: string;
}

export interface EnvaseZombieItem {
  stockHogarId: string;
  productoNombre: string;
  diasAbierto: number;
  sugerencia: string;
}

export interface ProductoClasificado {
  productoNombre: string;
  vecesComprado: number;
  vecesVencido: number;
  frecuenciaCompraDias: number;
}

export interface ClasificacionProductos {
  esenciales: ProductoClasificado[];
  recurrentes: ProductoClasificado[];
  ocasionales: ProductoClasificado[];
  caprichosos: ProductoClasificado[];
}

export interface RecetaTopItem {
  recetaId: string;
  nombre: string;
  vecesCocinada: number;
}

export interface PatronesCocina {
  diaQueMasCocinan: string | null;
  cocinadasEnDiaTop: number;
  ingredientesTop: string[];
  recetasTop: RecetaTopItem[];
}

export interface ResumenInsights {
  totalProductosAlacena: number;
  productosPorVencerSemana: number;
  consumosUltimos30Dias: number;
  tasaDesperdicioPorc: number;
  tasaDesperdicioMesAnteriorPorc: number;
  frecuenciaCompraHogarDias: number;
  productosEsenciales: number;
}

export interface InsightsHogarResponse {
  comprarPronto: ComprarProntoItem[];
  porVencer: PorVencerItem[];
  desperdicios: DesperdicioItem[];
  envasesZombies: EnvaseZombieItem[];
  clasificacion: ClasificacionProductos;
  patrones: PatronesCocina;
  resumen: ResumenInsights;
}

@Injectable({ providedIn: 'root' })
export class InsightsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getForHogar(): Observable<InsightsHogarResponse> {
    return this.http.get<InsightsHogarResponse>(`${this.base}/insights/hogar`);
  }
}
