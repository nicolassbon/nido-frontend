import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { expect, vi } from 'vitest';
import { Router } from '@angular/router';
import {
  AlertCircle,
  Check,
  Eye,
  History,
  ChevronDown,
  ImageOff,
  ListCollapse,
  Loader,
  LUCIDE_ICONS,
  LucideIconProvider,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SearchX,
  Send,
  ShoppingBasket,
  ShoppingCart,
  Trash2,
  Wheat,
  X,
} from 'lucide-angular';
import { ListaCompras } from './lista-compras';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem } from './lista-compras.service';
import { CatalogoService } from '../../core/servicios/catalogo.service';
import { AlacenaApiService } from '../alacena/alacena-api.service';
import { ComparadorApiService } from './comparador-api.service';

describe('ListaCompras', () => {
  let fixture: ComponentFixture<ListaCompras>;
  let component: ListaCompras;
  let listaService: FakeListaComprasService;
  let alacenaApi: FakeAlacenaApiService;
  let comparadorApi: FakeComparadorApiService;

  beforeEach(async () => {
    listaService = new FakeListaComprasService();
    alacenaApi = new FakeAlacenaApiService();
    comparadorApi = new FakeComparadorApiService();

    await TestBed.configureTestingModule({
      imports: [ListaCompras],
      providers: [
        { provide: ListaComprasService, useValue: listaService },
        {
          provide: CatalogoService,
          useValue: {
            getUnidadesMedida: () => of([]),
            getCategorias: () => of([{ id: 'cat-harinas', nombre: 'Harinas', ttlDias: null }]),
          },
        },
        { provide: AlacenaApiService, useValue: alacenaApi },
        { provide: ComparadorApiService, useValue: comparadorApi },
        { provide: Router, useValue: { getCurrentNavigation: () => null, navigate: vi.fn() } },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            AlertCircle,
            Check,
            Eye,
            History,
            ChevronDown,
            ImageOff,
            ListCollapse,
            Loader,
            PackagePlus,
            Pencil,
            Plus,
            Search,
            SearchX,
            Send,
            ShoppingBasket,
            ShoppingCart,
            Trash2,
            Wheat,
            X,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaCompras);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pasa un item del historial a la alacena', () => {
    const item = historyItem({ nombre: 'Harina', cantidad: 500, unidad: 'g', categoriaNombre: 'Harinas' });

    (component as any).sendHistoryItemToPantry(item);

    expect(alacenaApi.createStock).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Harina',
      cantidad: 500,
      unidadMedida: 'g',
      categoriaId: 'cat-harinas',
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

  it('no reenvia un item del historial que ya fue agregado', () => {
    const item = historyItem({ id: 'hist-1', agregadoAlInventario: true });

    (component as any).sendHistoryItemToPantry(item);

    expect(alacenaApi.createStock).not.toHaveBeenCalled();
    expect(listaService.markAddedToInventory).not.toHaveBeenCalled();
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

    (component as any).toggleShowAllLists();

    const allList = (component as any).activeList() as RecipeShoppingList;
    expect(allList.recetaNombre).toBe('Ver Todo');
    expect((component as any).visibleLists()).toHaveLength(1);
    expect(allList.items.find(item => item.nombre === 'Harina')?.cantidad).toBe(1500);
    expect(allList.items.find(item => item.nombre === 'Harina')?.unidad).toBe('g');
    expect(allList.items.filter(item => item.nombre === 'Acelga')).toHaveLength(2);

    (component as any).selectList('lista-1');
    const separated = (component as any).activeList() as RecipeShoppingList;
    expect(separated.recetaNombre).toBe('Receta A');
    expect(separated.items).toHaveLength(2);
  });

  it('envia la lista activa a Telegram y muestra estado enviado', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-2', productoId: null, nombre: 'Fideos', cantidad: 1, unidad: 'paquete', checked: false },
      ]),
    ]);
    fixture.detectChanges();

    getTelegramButton().click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Todas las compras pendientes');
    expect((component as any).showTelegramModal).toBe(true);
  });

  it('selecciona por defecto la lista activa seleccionada en la vista', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-2', productoId: null, nombre: 'Fideos', cantidad: 1, unidad: 'paquete', checked: false },
      ]),
    ]);
    (component as any).selectList('lista-2');
    fixture.detectChanges();

    (component as any).sendActiveListToTelegram();
    expect((component as any).selectedTelegramTargetId).toBe('lista-2');
  });

  it('selecciona por defecto todas las compras pendientes si se selecciono ver todas las listas o ver todo', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-2', productoId: null, nombre: 'Fideos', cantidad: 1, unidad: 'paquete', checked: false },
      ]),
    ]);
    (component as any).toggleShowAllLists();
    fixture.detectChanges();

    (component as any).sendActiveListToTelegram();
    expect((component as any).selectedTelegramTargetId).toBe('__telegram_all_pending__');
  });

  it('envia una lista concreta a Telegram desde el modal', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-2', productoId: null, nombre: 'Fideos', cantidad: 1, unidad: 'paquete', checked: false },
      ]),
    ]);

    (component as any).sendActiveListToTelegram();
    (component as any).selectedTelegramTargetId = 'lista-2';
    (component as any).confirmTelegramSend();

    expect(listaService.sendToTelegram).toHaveBeenCalledWith('lista-2');
    expect((component as any).telegramSendState).toBe('sent');
    expect((component as any).telegramSendMessage).toBe('Lista enviada a Telegram.');
  });

  it('envia todas las compras pendientes como null', () => {
    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
      shoppingList('lista-2', 'Receta B', [
        { id: 'item-2', productoId: null, nombre: 'Fideos', cantidad: 1, unidad: 'paquete', checked: false },
      ]),
    ]);

    (component as any).sendActiveListToTelegram();
    (component as any).selectedTelegramTargetId = '__telegram_all_pending__';
    (component as any).confirmTelegramSend();

    expect(listaService.sendToTelegram).toHaveBeenCalledWith(null);
  });

  it('muestra CTA para vincular Telegram cuando el backend responde sin enlace', () => {
    (listaService as any).sendToTelegram = vi.fn(() => throwError(() => ({ status: 409, error: { status: 'no_telegram_link' } })));

    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
    ]);

    (component as any).sendActiveListToTelegram();
    (component as any).confirmTelegramSend();
    fixture.detectChanges();

    expect((component as any).telegramSendState).toBe('no_telegram_link');
    expect(fixture.nativeElement.textContent).toContain('Ir a configuración');
  });

  it('muestra estado vacio sin tratarlo como error', () => {
    (listaService as any).sendToTelegram = vi.fn(() => of({ status: 'empty' as const, itemCount: 0, chatId: null, listaId: null }));

    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
    ]);

    (component as any).sendActiveListToTelegram();
    (component as any).confirmTelegramSend();

    expect((component as any).telegramSendState).toBe('empty');
    expect((component as any).telegramSendMessage).toBe('La lista está vacía.');
    expect((component as any).errorMessage).toBeNull();
  });

  it('deshabilita confirmar mientras la solicitud esta en curso', () => {
    const pending = new Subject<{ status: 'enqueued'; itemCount: number; chatId: number; listaId: string | null }>();
    (listaService as any).sendToTelegram = vi.fn(() => pending.asObservable());

    listaService.emitLists([
      shoppingList('lista-1', 'Receta A', [
        { id: 'item-1', productoId: null, nombre: 'Arroz', cantidad: 1, unidad: 'kg', checked: false },
      ]),
    ]);

    (component as any).sendActiveListToTelegram();
    fixture.detectChanges();
    getConfirmTelegramButton().click();
    fixture.detectChanges();

    expect((component as any).isSendingTelegram).toBe(true);
    expect(getConfirmTelegramButton().disabled).toBe(true);
  });

  function getTelegramButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[aria-label="telegram-send"]')
      ?? fixture.nativeElement.querySelectorAll('button')[1];
  }

  function getConfirmTelegramButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[aria-label="telegram-confirm-send"]');
  }

  describe('Comparador de precios', () => {
    it('abre el modal y realiza la busqueda', () => {
      expect((component as any).showCompareModal).toBe(false);

      (component as any).openCompareModal('fideos');
      expect((component as any).showCompareModal).toBe(true);
      expect((component as any).compareQuery).toBe('fideos');

      const mockResponse = {
        products: [
          { id: '1', name: 'Fideos 500g', price: 800, source: 'Dia', link: '', image: '', unit: '', unitPrice: 0 }
        ],
        failedScrapers: [],
        timestamp: ''
      };
      comparadorApi.compararPrecios.mockReturnValue(of(mockResponse));

      (component as any).searchPrices();
      expect((component as any).compareLoading).toBe(false);
      expect((component as any).compareSearched).toBe(true);
      expect((component as any).compareResults.length).toBe(1);
      expect((component as any).compareResults[0].name).toBe('Fideos 500g');
    });

    it('muestra el mensaje funcional del backend cuando el comparador esta caido', () => {
      const backendMessage = 'No pudimos comparar precios en este momento. Intentá nuevamente en unos minutos.';
      comparadorApi.compararPrecios.mockReturnValue(throwError(() => ({ error: { message: backendMessage } })));
      (component as any).openCompareModal('leche');

      (component as any).searchPrices();

      expect((component as any).compareError).toBe(backendMessage);
      expect((component as any).compareLoading).toBe(false);
      expect((component as any).compareSearched).toBe(true);
    });

    it('no muestra estado de sin resultados cuando la busqueda fallo', () => {
      comparadorApi.compararPrecios.mockReturnValue(throwError(() => ({ error: { message: 'Servicio no disponible' } })));
      (component as any).openCompareModal('leche');

      (component as any).searchPrices();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Servicio no disponible');
      expect(fixture.nativeElement.textContent).not.toContain('No encontramos resultados para tu búsqueda.');
    });

    it('usa mensaje generico cuando el backend no envia mensaje funcional', () => {
      comparadorApi.compararPrecios.mockReturnValue(throwError(() => ({ error: {} })));
      (component as any).openCompareModal('leche');

      (component as any).searchPrices();

      expect((component as any).compareError).toBe('Ocurrió un error al buscar precios. Intentá de nuevo.');
    });

    it('agrega un producto desde el comparador a la lista activa', () => {
      (component as any).activeListId = 'lista-1';
      (component as any).listas = [shoppingList('lista-1', 'Principal', [])];

      (component as any).addComparedProduct('Fideos 500g');
      expect(listaService.addItem).toHaveBeenCalledWith('lista-1', 'Fideos 500g', 1, 'unidad');
    });
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
  sendToTelegram = vi.fn(() => of({ status: 'enqueued', itemCount: 1, chatId: 1, listaId: null }));

  emitLists(listas: RecipeShoppingList[]): void {
    this.listas.next(listas);
  }
}

class FakeAlacenaApiService {
  getStock = vi.fn(() => of([]));
  createStock = vi.fn(() => of({}));
}

class FakeComparadorApiService {
  compararPrecios = vi.fn((): any => of({ products: [], failedScrapers: [], timestamp: '' }));
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
    agregadoAlInventario: false,
    ...overrides,
  };
}
