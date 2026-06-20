import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
  cantidadEnvases:     number;
  origenCarga:          'manual' | 'codigo_barras' | 'ticket_compra';
}

export type DeleteStockMotivo = 'consumido' | 'descartado' | 'vencido';
export type StockMovementMotivo = DeleteStockMotivo | 'cocinado';

export interface CreateStockItemRequest {
  nombre:              string;
  categoriaId?:        string | null;
  codigoBarras:        string | null;
  imagen:              string | null;
  ubicacion:           string;
  cantidad:            number;
  unidadMedida?:       string | null;
  fechaVencimiento:    string | null;
  estaAbierto:         boolean;
  porcentajeConsumido: number;
  cantidadEnvases?:    number;
  origenCarga?:         'manual' | 'codigo_barras' | 'ticket_compra';
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

export interface StockMovementResponse {
  id:             string;
  productoId:     string | null;
  productoNombre: string;
  cantidad:       number;
  unidadMedida:   string | null;
  motivo:         StockMovementMotivo;
  fechaConsumo:   string;
  usuarioId:      string | null;
}

export interface StockMovementFilters {
  motivo?: StockMovementMotivo | 'todos';
  desde?:  string | null;
  hasta?:  string | null;
  q?:      string | null;
  limit?:  number;
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

  deleteStock(id: string, motivo?: DeleteStockMotivo): Observable<void> {
    const options = motivo ? { params: { motivo } } : undefined;
    return this.http.delete<void>(`${this.base}/alacena/productos/${id}`, options);
  }

  getMovimientos(filters: StockMovementFilters = {}): Observable<StockMovementResponse[]> {
    const params: Record<string, string> = {};

    if (filters.motivo && filters.motivo !== 'todos') params['motivo'] = filters.motivo;
    if (filters.desde) params['desde'] = filters.desde;
    if (filters.hasta) params['hasta'] = filters.hasta;
    if (filters.q?.trim()) params['q'] = filters.q.trim();
    if (filters.limit) params['limit'] = String(filters.limit);

    return this.http
      .get<StockMovementResponse[]>(`${this.base}/alacena/movimientos`, { params })
      .pipe(
        map(response => Array.isArray(response) ? response : []),
        catchError(() => of([])),
      );
  }
}
