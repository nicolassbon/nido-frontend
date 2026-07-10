import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { FinanzasApiService } from './finanzas-api.service';
import { environment } from '../../../environments/environment';

describe('FinanzasApiService', () => {
  let service: FinanzasApiService;
  let http: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinanzasApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  // ── getGastos ──────────────────────────────────────────────────────────────

  it('getGastos() hace GET a /finanzas/gastos con parámetros de fecha', () => {
    service.getGastos('2026-01-01', '2026-01-31').subscribe();

    const req = http.expectOne(r => r.url === `${base}/finanzas/gastos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    req.flush({ gastos: [], totalPeriodo: 0 });
  });

  it('getGastos() devuelve lista vacía como fallback ante un error', async () => {
    const promise = firstValueFrom(service.getGastos());
    http.expectOne(`${base}/finanzas/gastos`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res).toEqual({ gastos: [], totalPeriodo: 0 });
  });

  it('getGastos() filtra por categoría cuando se indica', () => {
    service.getGastos(undefined, undefined, 'Comida').subscribe();

    const req = http.expectOne(r => r.url === `${base}/finanzas/gastos`);
    expect(req.request.params.get('categoria')).toBe('Comida');
    req.flush({ gastos: [], totalPeriodo: 0 });
  });

  // ── createGasto ────────────────────────────────────────────────────────────

  it('createGasto() hace POST a /finanzas/gastos con el cuerpo correcto', () => {
    const cuerpo = { monto: 500, descripcion: 'Super', categoria: 'Comida', fecha: '2026-01-15', pagadoPorId: null, esCompartido: true, participantesIds: null };
    service.createGasto(cuerpo).subscribe();

    const req = http.expectOne(`${base}/finanzas/gastos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({ id: '1', monto: 500, descripcion: 'Super', categoria: 'Comida', fecha: '2026-01-15', pagadoPorId: 'u1', pagadoPorNombre: 'Ana', createdAt: '' });
  });

  // ── getBalance ─────────────────────────────────────────────────────────────

  it('getBalance() hace GET a /finanzas/balance con parámetros de fecha', () => {
    service.getBalance('2026-01-01', '2026-01-31').subscribe();

    const req = http.expectOne(r => r.url === `${base}/finanzas/balance`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    req.flush({ miembros: [], totalPeriodo: 0 });
  });

  // ── getFacturas ────────────────────────────────────────────────────────────

  it('getFacturas() devuelve array vacío como fallback ante un error', async () => {
    const promise = firstValueFrom(service.getFacturas());
    http.expectOne(`${base}/finanzas/facturas`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res).toEqual([]);
  });

  // ── createFactura ──────────────────────────────────────────────────────────

  it('createFactura() hace POST con FormData y los campos requeridos', () => {
    service.createFactura({ nombre: 'Luz', tipo: 'servicio', monto: 1500, fechaVencimiento: '2026-02-01', archivo: null }).subscribe();

    const req = http.expectOne(`${base}/finanzas/facturas`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('nombre')).toBe('Luz');
    expect(body.get('tipo')).toBe('servicio');
    expect(body.get('monto')).toBe('1500');
    req.flush({ id: '1', nombre: 'Luz', tipo: 'servicio', monto: 1500, fechaVencimiento: '2026-02-01', archivoUrl: null, pagada: false, diasParaVencer: 17, creadoPor: 'u1', creadoPorNombre: 'Ana', createdAt: '' });
  });

  // ── marcarPagada ───────────────────────────────────────────────────────────

  it('marcarPagada() hace PATCH a /finanzas/facturas/:id/pagar', () => {
    service.marcarPagada('factura-1').subscribe();

    const req = http.expectOne(`${base}/finanzas/facturas/factura-1/pagar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ factura: {}, gastoCreado: null });
  });

  // ── deleteFactura ──────────────────────────────────────────────────────────

  it('deleteFactura() hace DELETE a /finanzas/facturas/:id', () => {
    service.deleteFactura('factura-2').subscribe();

    const req = http.expectOne(`${base}/finanzas/facturas/factura-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ── modo ahorro endpoints ──────────────────────────────────────────────────

  it('getSavingsPotencial() devuelve datos vacíos como fallback ante un error', async () => {
    const promise = firstValueFrom(service.getSavingsPotencial());
    http.expectOne(`${base}/finanzas/modo-ahorro/potencial`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res).toEqual({ totalPotencial: 0, periodoBaseMeses: 3, categorias: [] });
  });

  it('getInsights() devuelve lista vacía como fallback ante un error', async () => {
    const promise = firstValueFrom(service.getInsights());
    http.expectOne(`${base}/finanzas/modo-ahorro/insights`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res).toEqual({ insights: [] });
  });

  it('getAlacenaOportunidades() devuelve datos vacíos como fallback ante un error', async () => {
    const promise = firstValueFrom(service.getAlacenaOportunidades());
    http.expectOne(`${base}/finanzas/modo-ahorro/alacena`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res).toEqual({ productosDestacados: [], recetasSugeridas: [], totalProductosEnCasa: 0 });
  });

  it('setModoAhorro() hace PATCH a /finanzas/modo-ahorro con el flag activo', () => {
    service.setModoAhorro(true).subscribe();

    const req = http.expectOne(`${base}/finanzas/modo-ahorro`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: true });
    req.flush({ activo: true });
  });

  // ── getPresupuesto ─────────────────────────────────────────────────────────

  it('getPresupuesto() hace GET a /finanzas/presupuesto', () => {
    service.getPresupuesto().subscribe();

    const req = http.expectOne(`${base}/finanzas/presupuesto`);
    expect(req.request.method).toBe('GET');
    req.flush({ monto: 5000, gastoActual: 1200, restante: 3800, anio: 2026, mes: 6 });
  });

  it('getPresupuesto() devuelve fallback con monto null ante un error', async () => {
    const promise = firstValueFrom(service.getPresupuesto());
    http.expectOne(`${base}/finanzas/presupuesto`).error(new ProgressEvent('error'));
    const res = await promise;
    expect(res.monto).toBeNull();
    expect(res.gastoActual).toBe(0);
  });

  // ── setPresupuesto ─────────────────────────────────────────────────────────

  it('setPresupuesto() hace PUT a /finanzas/presupuesto con el monto', () => {
    service.setPresupuesto(5000).subscribe();

    const req = http.expectOne(`${base}/finanzas/presupuesto`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ monto: 5000 });
    req.flush({ monto: 5000, gastoActual: 0, restante: 5000, anio: 2026, mes: 6 });
  });

  // ── updateGasto ────────────────────────────────────────────────────────────

  it('updateGasto() hace PATCH a /finanzas/gastos/:id con el cuerpo correcto', () => {
    const cuerpo = { monto: 800, descripcion: 'Editado', categoria: 'Comida', fecha: '2026-06-15', pagadoPorId: null, esCompartido: true, participantesIds: null };
    service.updateGasto('gasto-1', cuerpo).subscribe();

    const req = http.expectOne(`${base}/finanzas/gastos/gasto-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({ id: 'gasto-1', monto: 800, descripcion: 'Editado', categoria: 'Comida', fecha: '2026-06-15', pagadoPorId: 'u1', pagadoPorNombre: 'Ana', createdAt: '', facturaId: null });
  });

  // ── deleteGasto ────────────────────────────────────────────────────────────

  it('deleteGasto() hace DELETE a /finanzas/gastos/:id', () => {
    service.deleteGasto('gasto-2').subscribe();

    const req = http.expectOne(`${base}/finanzas/gastos/gasto-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ facturaRevertida: false, facturaId: null });
  });
});
