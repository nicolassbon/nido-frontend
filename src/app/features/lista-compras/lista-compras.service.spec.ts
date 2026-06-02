import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ListaComprasService, RecipeShoppingList } from './lista-compras.service';

describe('ListaComprasService', () => {
  let service: ListaComprasService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ListaComprasService] });
    service = TestBed.inject(ListaComprasService);
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('addToLista debería agregar una lista nueva', () => {
    service.addToLista('Arroz con leche', [{ nombre: 'Arroz', cantidad: 200, unidad: 'g' }]);

    expect(service.snapshot).toHaveLength(1);
    expect(service.snapshot[0].recetaNombre).toBe('Arroz con leche');
    expect(service.snapshot[0].items[0].checked).toBe(false);
  });

  it('addToLista debería reemplazar una lista existente con el mismo nombre', () => {
    service.addToLista('Receta', [{ nombre: 'Arroz', cantidad: 1, unidad: null }]);
    service.addToLista('Receta', [{ nombre: 'Leche', cantidad: 2, unidad: 'lt' }]);

    expect(service.snapshot).toHaveLength(1);
    expect(service.snapshot[0].items[0].nombre).toBe('Leche');
  });

  it('toggleItem debería marcar un item como comprado', () => {
    service.addToLista('Receta', [{ nombre: 'Tomate', cantidad: 2, unidad: null }]);
    service.toggleItem('Receta', 0);

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('toggleItem debería desmarcar un item ya comprado', () => {
    service.addToLista('Receta', [{ nombre: 'Tomate', cantidad: 2, unidad: null }]);
    service.toggleItem('Receta', 0);
    service.toggleItem('Receta', 0);

    expect(service.snapshot[0].items[0].checked).toBe(false);
  });

  it('marcarCompradoPorNombre debería marcar un item con nombre exacto', () => {
    service.addToLista('Receta', [{ nombre: 'Pimentón', cantidad: 1, unidad: 'cdita' }]);

    service.marcarCompradoPorNombre('Pimentón');

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre debería funcionar con match parcial (producto contiene nombre item)', () => {
    service.addToLista('Receta', [{ nombre: 'Arroz', cantidad: 200, unidad: 'g' }]);

    service.marcarCompradoPorNombre('Arroz integral');

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre debería funcionar con match parcial inverso (nombre item contiene producto)', () => {
    service.addToLista('Receta', [{ nombre: 'Caldo de pollo', cantidad: 1, unidad: 'unidad' }]);

    service.marcarCompradoPorNombre('caldo');

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre debería ser case-insensitive', () => {
    service.addToLista('Receta', [{ nombre: 'Chile en Polvo', cantidad: 1, unidad: 'cdita' }]);

    service.marcarCompradoPorNombre('chile en polvo');

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre no debería afectar items sin coincidencia', () => {
    service.addToLista('Receta', [
      { nombre: 'Tomate', cantidad: 2, unidad: null },
      { nombre: 'Cebolla', cantidad: 1, unidad: null },
    ]);

    service.marcarCompradoPorNombre('Arroz');

    expect(service.snapshot[0].items[0].checked).toBe(false);
    expect(service.snapshot[0].items[1].checked).toBe(false);
  });

  it('marcarCompradoPorNombre no debería modificar items ya marcados', () => {
    service.addToLista('Receta', [{ nombre: 'Arroz', cantidad: 200, unidad: 'g' }]);
    service.toggleItem('Receta', 0);

    service.marcarCompradoPorNombre('Arroz');

    expect(service.snapshot[0].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre debería marcar en múltiples listas a la vez', () => {
    service.addToLista('Receta 1', [{ nombre: 'Arroz', cantidad: 200, unidad: 'g' }]);
    service.addToLista('Receta 2', [{ nombre: 'Arroz con verduras', cantidad: 150, unidad: 'g' }]);

    service.marcarCompradoPorNombre('Arroz');

    expect(service.snapshot[0].items[0].checked).toBe(true);
    expect(service.snapshot[1].items[0].checked).toBe(true);
  });

  it('marcarCompradoPorNombre debería persistir en localStorage', () => {
    service.addToLista('Receta', [{ nombre: 'Pimentón', cantidad: 1, unidad: null }]);

    service.marcarCompradoPorNombre('Pimentón');

    const stored: RecipeShoppingList[] = JSON.parse(localStorage.getItem('nido_listas_compras')!);
    expect(stored[0].items[0].checked).toBe(true);
  });

  it('totalPendiente$ debería decrementar al marcar un item como comprado', async () => {
    service.addToLista('Receta', [
      { nombre: 'Arroz', cantidad: 1, unidad: null },
      { nombre: 'Leche', cantidad: 1, unidad: null },
    ]);

    service.marcarCompradoPorNombre('Arroz');

    const n = await firstValueFrom(service.totalPendiente$);
    expect(n).toBe(1);
  });

  it('removeRecetaLista debería eliminar la lista indicada', () => {
    service.addToLista('A', [{ nombre: 'x', cantidad: 1, unidad: null }]);
    service.addToLista('B', [{ nombre: 'y', cantidad: 1, unidad: null }]);

    service.removeRecetaLista('A');

    expect(service.snapshot).toHaveLength(1);
    expect(service.snapshot[0].recetaNombre).toBe('B');
  });

  it('clearAll debería vaciar todas las listas y el localStorage', () => {
    service.addToLista('Receta', [{ nombre: 'x', cantidad: 1, unidad: null }]);

    service.clearAll();

    expect(service.snapshot).toHaveLength(0);
    expect(localStorage.getItem('nido_listas_compras')).toBeNull();
  });
});
