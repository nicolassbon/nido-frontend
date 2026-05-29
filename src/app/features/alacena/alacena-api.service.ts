import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

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

/** Fields the caller provides. hogarId and usuarioId are added by the service. */
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
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  private get hogarId():   string { return this.auth.getHogarId()   ?? ''; }
  private get usuarioId(): string { return this.auth.getUserId()     ?? ''; }

  /** Load all stock items for the current household. */
  getStock(): Observable<StockItemResponse[]> {
    return this.http
      .get<StockItemResponse[]>(`${this.base}/api/alacena/productos`, {
        params: { hogarId: this.hogarId },
      })
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

  /** Save a new product + stock entry. */
  createStock(req: CreateStockItemRequest): Observable<StockItemResponse> {
    return this.http.post<StockItemResponse>(
      `${this.base}/api/alacena/productos`,
      {
        ...req,
        // TODO: replace with values from JWT claims once auth is implemented
        hogarId:   this.hogarId,
        usuarioId: this.usuarioId,
      },
    );
  }

  /** Update quantity / details of an existing stock entry. */
  updateStock(id: string, changes: UpdateStockItemRequest): Observable<StockItemResponse> {
    return this.http.patch<StockItemResponse>(
      `${this.base}/api/alacena/productos/${id}`,
      { ...changes, usuarioId: this.usuarioId },
    );
  }

  /** Remove a stock entry. */
  deleteStock(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/alacena/productos/${id}`);
  }
}
