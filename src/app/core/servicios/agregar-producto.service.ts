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

@Injectable({
  providedIn: 'root'

})
export class ProductService {

private readonly baseUrl = environment.apiBaseUrl;
  constructor(private http: HttpClient) {}

createProducto(payload: CreateProductoRequest) {
  return this.http.post(`${this.baseUrl}/productos`, payload);
}}
