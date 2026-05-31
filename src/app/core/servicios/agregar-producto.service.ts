import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';


export interface CreateProductoRequest {
  nombre: string;
  categoriaId: string;
  cantidad: number;
  unidadMedida: string;
  fechaVencimiento?: string;
  hogarId: string;
  usuarioId: string;
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
}


@Injectable({
  providedIn: 'root'

})
export class ProductService {

private readonly baseUrl = environment.apiBaseUrl;
  constructor(private http: HttpClient) {}

createProducto(payload: CreateProductoRequest) {
  return this.http.post(`${this.baseUrl}/productos`, payload);
}

getProductManual(hogarId: string) {
  return this.http.get<ProductManualResponse[]>(
    `${this.baseUrl}/productos/manual?hogarId=${hogarId}`
  );
}

}
