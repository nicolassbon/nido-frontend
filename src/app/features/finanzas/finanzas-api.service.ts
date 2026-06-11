import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Response types ────────────────────────────────────────────────────────────

export interface GastoResponse {
  id: string;
  monto: number;
  descripcion: string | null;
  categoria: string | null;
  fecha: string;
  pagadoPorId: string;
  pagadoPorNombre: string;
  createdAt: string;
}

export interface GastosListResponse {
  gastos: GastoResponse[];
  totalPeriodo: number;
}

export interface BalanceMiembroResponse {
  usuarioId: string;
  nombre: string;
  fotoUrl: string | null;
  montoAportado: number;
  montoCorrespondido: number;
  balance: number;
}

export interface BalanceResponse {
  miembros: BalanceMiembroResponse[];
  totalPeriodo: number;
}

export interface ModoAhorroResponse {
  activo: boolean;
}

export interface RecetaRecomendadaResponse {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  ingredientesEnStock: number;
  totalIngredientes: number;
}

export interface RecomendacionesResponse {
  recetas: RecetaRecomendadaResponse[];
  tips: string[];
}

export interface FacturaResponse {
  id: string;
  nombre: string;
  tipo: string;
  monto: number | null;
  fechaVencimiento: string | null;
  archivoUrl: string | null;
  pagada: boolean;
  diasParaVencer: number | null;
  creadoPor: string;
  creadoPorNombre: string;
  createdAt: string;
}

export interface PagarFacturaResponse {
  factura: FacturaResponse;
  gastoCreado: GastoResponse | null;
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateGastoRequest {
  monto: number;
  descripcion: string | null;
  categoria: string | null;
  fecha: string;
  pagadoPorId: string | null;
}

export interface CreateFacturaRequest {
  nombre: string;
  tipo: string;
  monto: number | null;
  fechaVencimiento: string | null;
  archivo: File | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FinanzasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getModoAhorro(): Observable<ModoAhorroResponse> {
    return this.http.get<ModoAhorroResponse>(`${this.base}/finanzas/modo-ahorro`);
  }

  setModoAhorro(activo: boolean): Observable<ModoAhorroResponse> {
    return this.http.patch<ModoAhorroResponse>(`${this.base}/finanzas/modo-ahorro`, { activo });
  }

  getRecomendaciones(): Observable<RecomendacionesResponse> {
    return this.http
      .get<RecomendacionesResponse>(`${this.base}/finanzas/recomendaciones`)
      .pipe(catchError(() => of({ recetas: [], tips: [] })));
  }

  getBalance(desde?: string, hasta?: string): Observable<BalanceResponse> {
    const params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;
    return this.http.get<BalanceResponse>(`${this.base}/finanzas/balance`, { params });
  }

  getGastos(desde?: string, hasta?: string, categoria?: string): Observable<GastosListResponse> {
    const params: Record<string, string> = {};
    if (desde) params['desde'] = desde;
    if (hasta) params['hasta'] = hasta;
    if (categoria) params['categoria'] = categoria;
    return this.http
      .get<GastosListResponse>(`${this.base}/finanzas/gastos`, { params })
      .pipe(catchError(() => of({ gastos: [], totalPeriodo: 0 })));
  }

  createGasto(req: CreateGastoRequest): Observable<GastoResponse> {
    return this.http.post<GastoResponse>(`${this.base}/finanzas/gastos`, req);
  }

  getFacturas(tipo?: string, pagada?: boolean, proximaDias?: number): Observable<FacturaResponse[]> {
    const params: Record<string, string> = {};
    if (tipo) params['tipo'] = tipo;
    if (pagada !== undefined) params['pagada'] = String(pagada);
    if (proximaDias !== undefined) params['proximaDias'] = String(proximaDias);
    return this.http
      .get<FacturaResponse[]>(`${this.base}/finanzas/facturas`, { params })
      .pipe(catchError(() => of([])));
  }

  createFactura(req: CreateFacturaRequest): Observable<FacturaResponse> {
    const form = new FormData();
    form.append('nombre', req.nombre);
    form.append('tipo', req.tipo);
    if (req.monto !== null) form.append('monto', String(req.monto));
    if (req.fechaVencimiento) form.append('fechaVencimiento', req.fechaVencimiento);
    if (req.archivo) form.append('archivo', req.archivo, req.archivo.name);
    return this.http.post<FacturaResponse>(`${this.base}/finanzas/facturas`, form);
  }

  marcarPagada(id: string): Observable<PagarFacturaResponse> {
    return this.http.patch<PagarFacturaResponse>(`${this.base}/finanzas/facturas/${id}/pagar`, {});
  }

  deleteFactura(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/finanzas/facturas/${id}`);
  }
}
