import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Response / request types (mirror the .NET DTOs) ─────────────────────────

export interface StockItemResponse {
  id:                  string;
  productoId:          string;
  nombre:              string;
  imagen:              string | null;
  codigoBarras:        string | null;
  ubicacion:           string;
  cantidad:            number;
  fechaVencimiento:    string | null;   // ISO yyyy-MM-dd
  estaAbierto:         boolean;
  porcentajeConsumido: number;
}

export interface CreateStockItemRequest {
  nombre:              string;
  codigoBarras:        string | null;
  imagen:              string | null;
  ubicacion:           string;
  cantidad:            number;
  fechaVencimiento:    string | null;
  estaAbierto:         boolean;
  porcentajeConsumido: number;
}

export interface UpdateStockItemRequest {
  cantidad?:            number;
  ubicacion?:           string;
  fechaVencimiento?:    string | null;
  estaAbierto?:         boolean;
  porcentajeConsumido?: number;
}

/** Returned by GET /api/productos/barcode/:barcode */
export interface ProductoApiResponse {
  id:              string;
  nombre:          string;
  codigoBarras:    string | null;
  imagen:          string | null;
  categoriaNombre: string | null;
  ttlDias:         number | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AlacenaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  // hogarId y usuarioId vienen del JWT (via auth.interceptor) — no se envían en el body

  /** Load all stock items for the current household (hogarId extraído del JWT en el backend). */
  getStock(): Observable<StockItemResponse[]> {
    return this.http
      .get<StockItemResponse[]>(`${this.base}/api/alacena/productos`)
      .pipe(catchError(() => of([])));
  }

  /**
   * Check our DB for a barcode before calling Open Food Facts.
   * Returns null on 404 (product not in our DB yet).
   */
  findProductByBarcode(barcode: string): Observable<ProductoApiResponse | null> {
    return this.http
      .get<ProductoApiResponse>(
        `${this.base}/api/productos/barcode/${encodeURIComponent(barcode)}`,
      )
      .pipe(
        catchError(err => {
          if (err.status === 404) return of(null);
          throw err;
        }),
      );
  }

  /** Save a new product + stock entry (hogarId y usuarioId vienen del JWT). */
  createStock(req: CreateStockItemRequest): Observable<StockItemResponse> {
    return this.http.post<StockItemResponse>(
      `${this.base}/api/alacena/productos`,
      req,
    );
  }

  /** Update quantity / details of an existing stock entry (usuarioId viene del JWT). */
  updateStock(id: string, changes: UpdateStockItemRequest): Observable<StockItemResponse> {
    return this.http.patch<StockItemResponse>(
      `${this.base}/api/alacena/productos/${id}`,
      changes,
    );
  }

  /** Remove a stock entry. */
  deleteStock(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/alacena/productos/${id}`);
  }
}
