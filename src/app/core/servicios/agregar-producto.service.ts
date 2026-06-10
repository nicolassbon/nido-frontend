import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';


export interface CreateStockHomeRequest {
  nombre:              string;
  categoriaId:         string;
  ubicacion:           string;
  cantidad:            number;
  unidadMedida:        string;
  fechaVencimiento?:   string;
  estaAbierto?:        boolean;
  porcentajeConsumido?: number;
  cantidadEnvases?:    number;
}

export interface ProductManualResponse {
  stockHogarId: string;
  productoId: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  codigoBarras: string | null;
  imagenUrl: string | null;
  ubicacion: string;
  cantidad: number;
  unidadMedida: string | null;
  fechaVencimiento: string | null;
  estaAbierto: boolean;
  porcentajeConsumido: number;
  cantidadEnvases: number;
}


@Injectable({
  providedIn: 'root'

})
export class ProductService {

private readonly baseUrl = environment.apiBaseUrl;
  constructor(private http: HttpClient) {}

createStockHome(payload: CreateStockHomeRequest) {
  return this.http.post<ProductManualResponse>(`${this.baseUrl}/productos`, payload);
}

getProductManual(hogarId?: string) {
  return this.http.get<ProductManualResponse[]>(
    `${this.baseUrl}/productos/manual`
  );
}

/** Busca productos en el catálogo global por nombre (substring, case-insensitive). */
searchProductos(q: string) {
  return this.http.get<SearchProductoResponse[]>(
    `${this.baseUrl}/productos/search?q=${encodeURIComponent(q)}`
  );
}

}

export interface SearchProductoResponse {
  nombre:          string;
  categoriaNombre: string | null;
  categoriaId:     string | null;
  unidadMedida:    string | null;
  ubicacion:       string | null;
}
