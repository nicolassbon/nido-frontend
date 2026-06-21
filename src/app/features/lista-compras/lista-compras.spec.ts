import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { expect, vi } from 'vitest';
import { Router } from '@angular/router';
import {
  Check,
  History,
  ListCollapse,
  LUCIDE_ICONS,
  LucideIconProvider,
  PackagePlus,
  Pencil,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
} from 'lucide-angular';
import { ListaCompras } from './lista-compras';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem } from './lista-compras.service';
import { CatalogoService } from '../../core/servicios/catalogo.service';
import { AlacenaApiService } from '../alacena/alacena-api.service';

describe('ListaCompras', () => {
  let fixture: ComponentFixture<ListaCompras>;
  let component: ListaCompras;
  let listaService: FakeListaComprasService;
  let alacenaApi: FakeAlacenaApiService;

  beforeEach(async () => {
    listaService = new FakeListaComprasService();
    alacenaApi = new FakeAlacenaApiService();

    await TestBed.configureTestingModule({
      imports: [ListaCompras],
      providers: [
        { provide: ListaComprasService, useValue: listaService },
        { provide: CatalogoService, useValue: { getUnidadesMedida: () => of([]) } },
        { provide: AlacenaApiService, useValue: alacenaApi },
        { provide: Router, useValue: { getCurrentNavigation: () => null, navigate: vi.fn() } },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Check,
            History,
            ListCollapse,
            PackagePlus,
            Pencil,
            Plus,
            ShoppingBasket,
            ShoppingCart,
            Trash2,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaCompras);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pasa un item del historial a la alacena', () => {
    const item = historyItem({ nombre: 'Harina', cantidad: 500, unidad: 'g' });

    (component as any).sendHistoryItemToPantry(item);

    expect(alacenaApi.createStock).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Harina',
      cantidad: 500,
      unidadMedida: 'g',
      origenCarga: 'manual',
      ubicacion: 'Alacena',
    }));
    expect(listaService.markAddedToInventory).toHaveBeenCalledWith('hist-item');
  });

  it('marca el item como agregado a inventario despues de subirlo a alacena', () => {
    const item = historyItem({ id: 'hist-1' });

    (component as any).sendHistoryItemToPantry(item);

    expect(listaService.markAddedToInventory).toHaveBeenCalledWith('hist-1');
  });

  it('muestra Ver Todo como una lista virtual sin borrar la separacion original', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Harina', cantidad: 500, unidad: 'g', checked: false },
        { id: 'item-2', productoId: null, nombre: 'Acelga', cantidad: 1, unidad: 'atado', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-3', productoId: null, nombre: 'harína', cantidad: 1, unidad: 'kg', checked: false },
        { id: 'item-4', productoId: null, nombre: 'Acelga', cantidad: 2, unidad: 'paquete', checked: false },
      ]),
    ]);

    (component as any).viewAll();

    const allList = (component as any).activeList() as RecipeShoppingList;
    expect(allList.recetaNombre).toBe('Ver Todo');
    expect(allList.items.find(item => item.nombre === 'Harina')?.cantidad).toBe(1500);
    expect(allList.items.find(item => item.nombre === 'Harina')?.unidad).toBe('g');
    expect(allList.items.filter(item => item.nombre === 'Acelga')).toHaveLength(2);

    (component as any).selectList('lista-1');
    const separated = (component as any).activeList() as RecipeShoppingList;
    expect(separated.recetaNombre).toBe('Receta A');
    expect(separated.items).toHaveLength(2);
  });
});

class FakeListaComprasService {
  private readonly listas = new BehaviorSubject<RecipeShoppingList[]>([]);
  private readonly historial = new BehaviorSubject<ShoppingHistoryItem[]>([]);

  readonly listas$ = this.listas.asObservable();
  readonly historial$ = this.historial.asObservable();
  readonly totalPendiente$ = of(0);

  refresh = vi.fn(() => of([]));
  refreshHistory = vi.fn(() => of([]));
  addToLista = vi.fn();
  createList = vi.fn(() => of([]));
  updateList = vi.fn(() => of([]));
  deleteList = vi.fn(() => of([]));
  addItem = vi.fn(() => of([]));
  updateItem = vi.fn(() => of([]));
  markPurchased = vi.fn(() => of([]));
  removeItem = vi.fn(() => of([]));
  markAddedToInventory = vi.fn(() => of([]));

  emitLists(listas: RecipeShoppingList[]): void {
    this.listas.next(listas);
  }
}

class FakeAlacenaApiService {
  getStock = vi.fn(() => of([]));
  createStock = vi.fn(() => of({}));
}

function shoppingList(id: string, recetaNombre: string, items: RecipeShoppingList['items']): RecipeShoppingList {
  return {
    id,
    recetaNombre,
    grupoNombre: recetaNombre,
    items,
  };
}

function historyItem(overrides: Partial<ShoppingHistoryItem> = {}): ShoppingHistoryItem {
  return {
    id: 'hist-item',
    productoId: null,
    nombre: 'Producto',
    cantidad: null,
    unidad: null,
    grupoNombre: 'Principal',
    compradoEn: '2026-06-19T10:00:00',
    compradoPor: null,
    ...overrides,
  };
}
