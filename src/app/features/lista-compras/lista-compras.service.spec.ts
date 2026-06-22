import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ListaComprasService } from './lista-compras.service';

describe('ListaComprasService', () => {
  let service: ListaComprasService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/listas-compra`;
  const legacyUrl = `${environment.apiBaseUrl}/lista-compras`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ListaComprasService],
    });

    service = TestBed.inject(ListaComprasService);
    http = TestBed.inject(HttpTestingController);
    flushInitialRequests();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('deberia cargar listas nombradas desde la API', () => {
    service.refresh().subscribe();

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Compra semanal', [
      item({ id: 'item-1', nombre: 'Arroz' }),
    ])]);

    expect(service.snapshot[0].id).toBe('lista-1');
    expect(service.snapshot[0].recetaNombre).toBe('Compra semanal');
    expect(service.snapshot[0].items[0].nombre).toBe('Arroz');
  });

  it('resuelve iconos de lista activa aunque la API venga sin icono o con alias viejo', () => {
    service.refresh().subscribe();

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Pasteles', [
      item({ id: 'item-1', nombre: 'Harina', icono: null }),
      item({ id: 'item-2', nombre: 'Pimienta negra a gusto para el relleno', icono: 'salt' }),
      item({ id: 'item-3', nombre: 'Aji molido opcional', icono: 'salt' }),
    ])]);

    expect(service.snapshot[0].items.find(i => i.nombre === 'Harina')?.icono).toBe('wheat');
    expect(service.snapshot[0].items.find(i => i.nombre.startsWith('Pimienta'))?.icono).toBe('leaf');
    expect(service.snapshot[0].items.find(i => i.nombre.startsWith('Aji'))?.icono).toBe('leaf');
  });

  it('no expone iconos en historial', () => {
    service.refreshHistory().subscribe();

    http.expectOne(`${baseUrl}/historial`).flush([
      historyItem({ id: 'item-1', nombre: 'Pimienta negra', icono: 'leaf' }),
    ]);

    let latestHistory: any[] = [];
    service.historial$.subscribe(items => {
      latestHistory = items;
    });

    expect(latestHistory[0].icono).toBeNull();
  });

  it('createList deberia llamar al endpoint nuevo', () => {
    service.createList('Verduleria').subscribe();

    const post = http.expectOne(baseUrl);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nombre: 'Verduleria' });
    post.flush(shoppingList('lista-2', 'Verduleria', []));

    http.expectOne(baseUrl).flush([shoppingList('lista-2', 'Verduleria', [])]);
    expect(service.snapshot[0].recetaNombre).toBe('Verduleria');
  });

  it('addItem deberia agregar un item manual a la lista indicada', () => {
    service.addItem('lista-1', 'Leche', 1, 'lt').subscribe();

    const post = http.expectOne(`${baseUrl}/lista-1/items`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nombre: 'Leche', cantidad: 1, unidad: 'lt' });
    post.flush(item({ id: 'item-1', nombre: 'Leche' }));

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Principal', [item({ id: 'item-1', nombre: 'Leche' })])]);
    expect(service.snapshot[0].items[0].nombre).toBe('Leche');
  });

  it('removeItem deberia borrar solo el item de su lista', () => {
    service.removeItem('lista-1', 'item-1').subscribe();

    const del = http.expectOne(`${baseUrl}/lista-1/items/item-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Principal', [])]);
    expect(service.snapshot[0].items).toHaveLength(0);
  });

  it('sendToTelegram deberia llamar al endpoint legacy sin listaId', () => {
    service.sendToTelegram().subscribe();

    const post = http.expectOne(`${environment.apiBaseUrl}/lista-compras/enviar-telegram`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({});
    post.flush({ status: 'enqueued', itemCount: 2, chatId: 123, listaId: null });
  });

  it('sendToTelegram deberia incluir listaId cuando se envia una lista puntual', () => {
    service.sendToTelegram('lista-1').subscribe();

    const post = http.expectOne(`${environment.apiBaseUrl}/lista-compras/enviar-telegram?listaId=lista-1`);
    expect(post.request.method).toBe('POST');
    post.flush({ status: 'empty', itemCount: 0, chatId: null, listaId: 'lista-1' });
  });

  it('markPurchased deberia actualizar item e historial', () => {
    service.markPurchased('lista-1', 'item-1', true).subscribe();

    const patch = http.expectOne(`${legacyUrl}/items/item-1/comprado`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({});
    patch.flush(item({ id: 'item-1', nombre: 'Pan', comprado: true }));

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Principal', [])]);
    http.expectOne(`${baseUrl}/historial`).flush([historyItem({ id: 'item-1', nombre: 'Pan' })]);
    expect(service.snapshot[0].items).toHaveLength(0);
  });

  it('markAddedToInventory deberia marcar item en el historial como agregado', () => {
    service.markAddedToInventory('item-1').subscribe();

    const patch = http.expectOne(`${legacyUrl}/items/item-1/agregado-inventario`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush(null);

    http.expectOne(`${baseUrl}/historial`).flush([historyItem({ id: 'item-1', nombre: 'Pan', agregadoAlInventario: true })]);
    http.expectOne(baseUrl).flush([]);
  });

  it('marcarCompradoPorNombre mantiene compatibilidad con endpoint legacy', () => {
    service.marcarCompradoPorNombre('Arroz');

    const patch = http.expectOne(`${legacyUrl}/items/comprado-por-nombre`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush([item({ id: 'item-1', nombre: 'Arroz', comprado: true })]);

    http.expectOne(baseUrl).flush([shoppingList('lista-1', 'Principal', [item({ id: 'item-1', nombre: 'Arroz', comprado: true })])]);
    http.expectOne(`${baseUrl}/historial`).flush([historyItem({ id: 'item-1', nombre: 'Arroz' })]);
  });

  it('markAddedToInventory marca el item del historial como agregado y refresca datos', () => {
    service.refreshHistory().subscribe();
    http.expectOne(`${baseUrl}/historial`).flush([
      historyItem({ id: 'item-1', nombre: 'Sal', cantidad: 500, unidad: 'g', agregadoAlInventario: false }),
      historyItem({ id: 'item-2', nombre: 'Azucar', cantidad: 1, unidad: 'kg', agregadoAlInventario: false }),
    ]);

    let latestHistory: any[] = [];
    service.historial$.subscribe(items => {
      latestHistory = items;
    });

    service.markAddedToInventory('item-1').subscribe();

    const patch = http.expectOne(`${legacyUrl}/items/item-1/agregado-inventario`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush(null);

    expect(latestHistory[0].agregadoAlInventario).toBe(true);

    http.expectOne(`${baseUrl}/historial`).flush([
      historyItem({ id: 'item-1', nombre: 'Sal', cantidad: 500, unidad: 'g', agregadoAlInventario: true }),
      historyItem({ id: 'item-2', nombre: 'Azucar', cantidad: 1, unidad: 'kg', agregadoAlInventario: false }),
    ]);
    http.expectOne(baseUrl).flush([]);

    expect(latestHistory[0].agregadoAlInventario).toBe(true);
  });

  function flushInitialRequests(): void {
    http.expectOne(baseUrl).flush([]);
    http.expectOne(`${baseUrl}/historial`).flush([]);
  }
});

function shoppingList(id: string, nombre: string, items: unknown[]) {
  return { id, nombre, createdAt: '2026-06-19T10:00:00', updatedAt: null, items };
}

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item',
    productoId: null,
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
    productoId: null,
    nombre: 'Producto',
    cantidad: null,
    unidad: null,
    grupoNombre: 'Principal',
    compradoEn: '2026-06-19T10:00:00',
    compradoPor: 'usuario-1',
    agregadoAlInventario: false,
    ...overrides,
  };
}
