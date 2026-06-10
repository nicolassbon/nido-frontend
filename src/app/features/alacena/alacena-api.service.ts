import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StockItemResponse {
  id:                  string;
  productoId:          string;
  nombre:              string;
  imagen:              string | null;
  codigoBarras:        string | null;
  categoriaNombre:     string | null;
  ubicacion:           string;
  cantidad:            number;
  unidadMedida:        string | null;
  fechaVencimiento:    string | null;   // ISO yyyy-MM-dd
  estaAbierto:         boolean;
  porcentajeConsumido: number;
  /** Cantidad de envases idénticos del mismo producto (default 1). */
  cantidadEnvases:     number;
}

export interface CreateStockItemRequest {
  nombre:              string;
  codigoBarras:        string | null;
  imagen:              string | null;
  ubicacion:           string;
  cantidad:            number;
  unidadMedida?:       string | null;
  fechaVencimiento:    string | null;
  estaAbierto:         boolean;
  porcentajeConsumido: number;
  cantidadEnvases?:    number;
}

export interface UpdateStockItemRequest {
  nombre?:              string;
  cantidad?:            number;
  ubicacion?:           string;
  unidadMedida?:        string;
  fechaVencimiento?:    string | null;
  estaAbierto?:         boolean;
  porcentajeConsumido?: number;
  cantidadEnvases?:     number;
}

export interface ProductoApiResponse {
  id:              string;
  nombre:          string;
  codigoBarras:    string | null;
  imagen:          string | null;
  categoriaNombre: string | null;
  ttlDias:         number | null;
}

@Injectable({ providedIn: 'root' })
export class AlacenaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getStock(): Observable<StockItemResponse[]> {
    return this.http
      .get<StockItemResponse[]>(`${this.base}/alacena/productos`)
      .pipe(catchError(() => of([])));
  }

  getStockById(id: string): Observable<StockItemResponse> {
    return this.http.get<StockItemResponse>(
      `${this.base}/alacena/productos/${encodeURIComponent(id)}`,
    );
  }

  findProductByBarcode(barcode: string): Observable<ProductoApiResponse | null> {
    return this.http
      .get<ProductoApiResponse>(
        `${this.base}/productos/barcode/${encodeURIComponent(barcode)}`,
      )
      .pipe(
        catchError(err => {
          if (err.status === 404) return of(null);
          throw err;
        }),
      );
  }

  createStock(req: CreateStockItemRequest): Observable<StockItemResponse> {
    return this.http.post<StockItemResponse>(
      `${this.base}/alacena/productos`,
      req,
    );
  }

  updateStock(id: string, changes: UpdateStockItemRequest): Observable<StockItemResponse> {
    return this.http.patch<StockItemResponse>(
      `${this.base}/alacena/productos/${id}`,
      changes,
    );
  }

  deleteStock(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/alacena/productos/${id}`);
  }
}
