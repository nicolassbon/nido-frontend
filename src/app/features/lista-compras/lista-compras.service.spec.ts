import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ListaComprasService } from './lista-compras.service';

describe('ListaComprasService', () => {
  let service: ListaComprasService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/lista-compras`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ListaComprasService],
    });

    service = TestBed.inject(ListaComprasService);
    http = TestBed.inject(HttpTestingController);
    flushInitialRequests();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('deberia crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('addGroupToLista deberia cargar un grupo devuelto por la API', () => {
    service.addGroupToLista('Receta', [{ nombre: 'Arroz', cantidad: 1, unidad: 'kg' }]).subscribe();

    const req = http.expectOne(`${baseUrl}/grupos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.grupoNombre).toBe('Receta');
    req.flush([
      group('Receta', [
        item({ id: 'item-1', nombre: 'Arroz', cantidad: 1, unidad: 'kg', orden: 0 }),
      ]),
    ]);

    expect(service.snapshot).toHaveLength(1);
    expect(service.snapshot[0].items[0].nombre).toBe('Arroz');
    expect(service.snapshot[0].items[0].checked).toBe(false);
  });

  it('addManualItem deberia agregar y refrescar la lista', () => {
    service.addManualItem('Leche', 1, 'lt').subscribe();

    const post = http.expectOne(`${baseUrl}/items`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.nombre).toBe('Leche');
    post.flush(item({ id: 'item-1', nombre: 'Leche' }));

    const refresh = http.expectOne(baseUrl);
    refresh.flush([group('Productos agregados', [item({ id: 'item-1', nombre: 'Leche' })])]);

    expect(service.snapshot[0].recetaNombre).toBe('Productos agregados');
    expect(service.snapshot[0].items[0].nombre).toBe('Leche');
  });

  it('markPurchased deberia marcar comprado y actualizar historial', () => {
    service.markPurchased('item-1').subscribe();

    const patch = http.expectOne(`${baseUrl}/items/item-1/comprado`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush(item({ id: 'item-1', nombre: 'Pan', comprado: true, compradoEn: '2026-06-17T10:00:00' }));

    const refresh = http.expectOne(baseUrl);
    refresh.flush([group('Productos agregados', [item({ id: 'item-1', nombre: 'Pan', comprado: true })])]);

    const history = http.expectOne(`${baseUrl}/historial`);
    history.flush([historyItem({ id: 'item-1', nombre: 'Pan' })]);

    expect(service.snapshot[0].items[0].checked).toBe(true);
    expect(service.historySnapshot[0].nombre).toBe('Pan');
  });

  it('marcarCompradoPorNombre deberia usar el endpoint por nombre', () => {
    service.marcarCompradoPorNombre('Arroz');

    const patch = http.expectOne(`${baseUrl}/items/comprado-por-nombre`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body.nombre).toBe('Arroz');
    patch.flush([item({ id: 'item-1', nombre: 'Arroz', comprado: true })]);

    const refresh = http.expectOne(baseUrl);
    refresh.flush([group('Receta', [item({ id: 'item-1', nombre: 'Arroz', comprado: true })])]);

    const history = http.expectOne(`${baseUrl}/historial`);
    history.flush([historyItem({ id: 'item-1', nombre: 'Arroz' })]);

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('removeItem deberia quitar un producto y refrescar', () => {
    service.removeItem('item-1').subscribe();

    const del = http.expectOne(`${baseUrl}/items/item-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);

    const refresh = http.expectOne(baseUrl);
    refresh.flush([]);

    expect(service.snapshot).toHaveLength(0);
  });

  it('clearAll deberia vaciar activos y conservar historial refrescado', () => {
    service.clearAll().subscribe();

    const del = http.expectOne(baseUrl);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);

    const history = http.expectOne(`${baseUrl}/historial`);
    history.flush([historyItem({ id: 'item-1', nombre: 'Pan' })]);

    expect(service.snapshot).toHaveLength(0);
    expect(service.historySnapshot[0].nombre).toBe('Pan');
  });

  function flushInitialRequests(): void {
    http.expectOne(baseUrl).flush([]);
    http.expectOne(`${baseUrl}/historial`).flush([]);
  }
});

function group(grupoNombre: string, items: unknown[]) {
  return { grupoNombre, items };
}

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item',
    productoId: 'producto-1',
    nombre: 'Producto',
    cantidad: null,
    unidad: null,
    comprado: false,
    compradoEn: null,
    orden: 0,
    ...overrides,
  };
}

function historyItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item',
    productoId: 'producto-1',
    nombre: 'Producto',
    cantidad: null,
    unidad: null,
    grupoNombre: 'Productos agregados',
    compradoEn: '2026-06-17T10:00:00',
    compradoPor: 'usuario-1',
    ...overrides,
  };
}

