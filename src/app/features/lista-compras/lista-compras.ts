import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem, ShoppingItem } from './lista-compras.service';
import { CatalogoService } from '../../core/servicios/catalogo.service';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { AlacenaApiService, CreateStockItemRequest } from '../alacena/alacena-api.service';
import { ComparadorApiService, ComparedProduct } from './comparador-api.service';

const VIEW_ALL_LIST_ID = '__all__';
const TELEGRAM_ALL_PENDING_OPTION = '__telegram_all_pending__';

@Component({
  selector: 'app-lista-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterModule, NidoSelectComponent],
  templateUrl: './lista-compras.html',
})
export class ListaCompras implements OnInit, OnDestroy {
  protected readonly service = inject(ListaComprasService);
  private readonly alacenaApi = inject(AlacenaApiService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly comparadorApi = inject(ComparadorApiService);

  protected listas: RecipeShoppingList[] = [];
  protected historial: ShoppingHistoryItem[] = [];
  protected totalPendiente = 0;
  protected errorMessage: string | null = null;

  protected showListForm = false;
  protected listName = '';
  protected editingListId: string | null = null;

  protected activeListId: string | null = null;
  protected showAllLists = false;
  protected itemNombre = '';
  protected itemCantidad: number | null = null;
  protected itemUnidad = 'unidad';
  protected editingItem: { listaId: string; itemId: string } | null = null;
  protected uploadingHistoryId: string | null = null;
  protected isSaving = false;
  protected isSendingTelegram = false;
  protected showTelegramModal = false;
  protected selectedTelegramTargetId: string = TELEGRAM_ALL_PENDING_OPTION;
  protected telegramSendState: 'idle' | 'sending' | 'sent' | 'empty' | 'no_telegram_link' | 'error' = 'idle';
  protected telegramSendMessage: string | null = null;
  protected unidadesOpts: NidoSelectOption[] = [];

  protected showCompareModal = false;
  protected compareQuery = '';
  protected compareLoading = false;
  protected compareResults: ComparedProduct[] = [];
  protected compareFailedScrapers: string[] = [];
  protected compareError: string | null = null;
  protected compareSuccessMessage: string | null = null;
  protected compareSearched = false;
  protected showAddToListModal = false;
  protected selectedComparedProduct: string | null = null;
  protected selectedAddToListTargetId: string | null = null;

  private sub = new Subscription();
  private readonly categoriaIdByName = new Map<string, string>();

  constructor() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { recetaNombre?: string; items?: RecipeShoppingList['items'] } | undefined;
    if (state?.recetaNombre && state?.items?.length) {
      this.service.addToLista(state.recetaNombre, state.items);
    }
  }

  ngOnInit(): void {
    this.service.refresh().subscribe();
    this.service.refreshHistory().subscribe();
    this.sub.add(this.catalogoService.getUnidadesMedida().subscribe(unidades => {
      this.unidadesOpts = CatalogoService.toUnidadesOpts(unidades);
      this.cdr.markForCheck();
    }));
    this.sub.add(this.catalogoService.getCategorias().subscribe(categorias => {
      this.categoriaIdByName.clear();
      for (const categoria of categorias) {
        this.categoriaIdByName.set(this.normalizeLookup(categoria.nombre), categoria.id);
      }
      this.cdr.markForCheck();
    }));

    this.sub.add(this.service.listas$.subscribe(listas => {
      this.listas = listas;
      if (!this.activeListId || (this.activeListId !== VIEW_ALL_LIST_ID && !listas.some(lista => lista.id === this.activeListId))) {
        this.activeListId = listas[0]?.id ?? null;
      }
      this.cdr.markForCheck();
    }));

    this.sub.add(this.service.totalPendiente$.subscribe(n => {
      this.totalPendiente = n;
      this.cdr.markForCheck();
    }));

    this.sub.add(this.service.historial$.subscribe(historial => {
      this.historial = historial;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.setScrollLock(false);
  }

  protected openCreateList(): void {
    this.showListForm = true;
    this.editingListId = null;
    this.listName = '';
    this.errorMessage = null;
  }

  protected editList(lista: RecipeShoppingList): void {
    this.showListForm = true;
    this.editingListId = lista.id;
    this.listName = lista.recetaNombre;
    this.errorMessage = null;
  }

  protected saveList(): void {
    const nombre = this.listName.trim();
    if (!nombre || this.isSaving) return;

    this.isSaving = true;
    const creating = !this.editingListId;
    const request = this.editingListId
      ? this.service.updateList(this.editingListId, nombre)
      : this.service.createList(nombre);

    request.subscribe({
      next: listas => {
        if (creating) {
          const created = [...listas].reverse().find(lista => lista.recetaNombre === nombre);
          this.activeListId = created?.id ?? this.activeListId;
        }

        this.showListForm = false;
        this.editingListId = null;
        this.listName = '';
        this.errorMessage = null;
        this.isSaving = false;
        this.cdr.markForCheck();
      },
      error: () => this.fail('No se pudo guardar la lista.'),
    });
  }

  protected deleteList(listaId: string, event: Event): void {
    event.stopPropagation();
    this.service.deleteList(listaId).subscribe({
      error: () => this.fail('No se pudo eliminar la lista.'),
    });
  }

  protected viewAll(): void {
    if (this.listas.length === 0) return;

    this.activeListId = VIEW_ALL_LIST_ID;
    this.errorMessage = null;
    this.cancelItemEdit();
    this.cdr.markForCheck();
  }

  protected selectList(listaId: string): void {
    this.activeListId = listaId;
    this.showAllLists = false;
    this.cancelItemEdit();
  }

  protected toggleShowAllLists(): void {
    if (this.activeListId === VIEW_ALL_LIST_ID) {
      this.activeListId = this.listas[0]?.id ?? null;
    } else {
      this.viewAll();
      return;
    }

    this.showAllLists = false;
    this.cancelItemEdit();
    this.cdr.markForCheck();
  }

  protected saveItem(listaId: string): void {
    const nombre = this.itemNombre.trim();
    if (!nombre || this.isSaving) return;

    this.isSaving = true;
    const request = this.editingItem
      ? this.service.updateItem(listaId, this.editingItem.itemId, {
          nombre,
          cantidad: this.itemCantidad,
          unidad: this.itemUnidad.trim() || null,
        })
      : this.service.addItem(listaId, nombre, this.itemCantidad, this.itemUnidad.trim() || null);

    request.subscribe({
      next: () => {
        this.cancelItemEdit();
        this.isSaving = false;
        this.cdr.markForCheck();
      },
      error: () => this.fail('No se pudo guardar el producto.'),
    });
  }

  protected editItem(listaId: string, item: ShoppingItem, event: Event): void {
    event.stopPropagation();
    this.activeListId = listaId;
    this.editingItem = { listaId, itemId: item.id };
    this.itemNombre = item.nombre;
    this.itemCantidad = item.cantidad;
    this.itemUnidad = item.unidad ?? 'unidad';
  }

  protected cancelItemEdit(): void {
    this.editingItem = null;
    this.itemNombre = '';
    this.itemCantidad = null;
    this.itemUnidad = 'unidad';
  }

  protected togglePurchased(listaId: string, item: ShoppingItem): void {
    const refs = item.sourceItems?.length
      ? item.sourceItems
      : [{ listaId, itemId: item.id }];

    forkJoin(refs.map(ref => this.service.markPurchased(ref.listaId, ref.itemId, !item.checked))).subscribe({
      error: () => this.fail('No se pudo actualizar el producto.'),
    });
  }

  protected removeItem(listaId: string, itemId: string, event: Event): void {
    event.stopPropagation();
    this.service.removeItem(listaId, itemId).subscribe({
      error: () => this.fail('No se pudo quitar el producto.'),
    });
  }

  protected sendHistoryItemToPantry(item: ShoppingHistoryItem): void {
    if (this.uploadingHistoryId || item.agregadoAlInventario) return;

    this.uploadingHistoryId = item.id;
    this.errorMessage = null;
    this.cdr.markForCheck();

    const amount = item.cantidad && item.cantidad > 0 ? item.cantidad : 1;
    const payload: CreateStockItemRequest = {
      nombre: item.nombre,
      categoriaId: this.categoryIdFor(item.categoriaNombre),
      codigoBarras: null,
      imagen: null,
      ubicacion: 'Alacena',
      cantidad: amount,
      unidadMedida: this.stockUnitValue(item.unidad),
      fechaVencimiento: null,
      estaAbierto: false,
      porcentajeConsumido: 0,
      origenCarga: 'manual',
    };

    this.alacenaApi.createStock(payload).subscribe({
      next: () => {
        this.service.markAddedToInventory(item.id).subscribe({
          next: () => {
            this.uploadingHistoryId = null;
            this.cdr.markForCheck();
          },
          error: () => {
            this.uploadingHistoryId = null;
            this.fail('Se subió a la alacena, pero no se pudo actualizar el historial.');
          },
        });
      },
      error: () => {
        this.uploadingHistoryId = null;
        this.fail('No se pudo pasar el producto a la alacena.');
      },
    });
  }

  protected sendActiveListToTelegram(): void {
    if (this.isSendingTelegram || this.listas.length === 0) {
      return;
    }

    this.selectedTelegramTargetId = this.defaultTelegramTargetId();
    this.showTelegramModal = true;
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  protected closeTelegramModal(): void {
    if (this.isSendingTelegram) {
      return;
    }

    this.showTelegramModal = false;
    this.cdr.markForCheck();
  }

  protected confirmTelegramSend(): void {
    if (this.isSendingTelegram || this.listas.length === 0) {
      return;
    }

    const targetListId = this.selectedTelegramTargetId === TELEGRAM_ALL_PENDING_OPTION
      ? null
      : this.selectedTelegramTargetId;
    this.isSendingTelegram = true;
    this.telegramSendState = 'sending';
    this.telegramSendMessage = null;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.service.sendToTelegram(targetListId).subscribe({
      next: result => {
        this.isSendingTelegram = false;
        this.showTelegramModal = false;
        this.telegramSendState = result.status === 'enqueued'
          ? 'sent'
          : 'empty';
        this.telegramSendMessage = result.status === 'enqueued'
          ? 'Lista enviada a Telegram.'
          : 'La lista está vacía.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.isSendingTelegram = false;
        this.showTelegramModal = false;
        if (error?.status === 409 && error?.error?.status === 'no_telegram_link') {
          this.telegramSendState = 'no_telegram_link';
          this.telegramSendMessage = 'Necesitás vincular Telegram para enviar la lista.';
        } else {
          this.telegramSendState = 'error';
          this.fail('No se pudo enviar la lista a Telegram.');
        }
        this.cdr.markForCheck();
      },
    });
  }

  protected activeList(): RecipeShoppingList | null {
    if (this.activeListId === VIEW_ALL_LIST_ID) {
      return this.buildAllList();
    }

    return this.listas.find(lista => lista.id === this.activeListId) ?? this.listas[0] ?? null;
  }

  protected visibleLists(): RecipeShoppingList[] {
    const active = this.activeList();
    return active ? [active] : [];
  }

  protected isViewingAll(): boolean {
    return this.activeListId === VIEW_ALL_LIST_ID;
  }

  protected isAllList(lista: RecipeShoppingList): boolean {
    return lista.id === VIEW_ALL_LIST_ID;
  }

  protected goToRecetas(): void {
    this.router.navigate(['/recetas']);
  }

  protected goToConfiguracion(): void {
    this.router.navigate(['/configuracion']);
  }

  protected pendientesDe(lista: RecipeShoppingList): number {
    return lista.items.filter(i => !i.checked).length;
  }

  protected formatAmount(cantidad: number | null, unidad: string | null): string {
    if (!cantidad && !unidad) return '';
    if (!cantidad) return unidad ?? '';
    const suffix = unidad ? ` ${unidad}` : '';
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(cantidad)}${suffix}`;
  }

  protected formatHistoryDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  protected telegramTargetOptions(): Array<{ id: string; label: string; pendingCount: number }> {
    return [
      {
        id: TELEGRAM_ALL_PENDING_OPTION,
        label: 'Todas las compras pendientes',
        pendingCount: this.totalPendiente,
      },
      ...this.listas.map(lista => ({
        id: lista.id,
        label: lista.recetaNombre,
        pendingCount: this.pendientesDe(lista),
      })),
    ];
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.uploadingHistoryId = null;
    this.isSaving = false;
    this.cdr.markForCheck();
  }

  private defaultTelegramTargetId(): string {
    if (this.activeListId && this.activeListId !== VIEW_ALL_LIST_ID && !this.showAllLists) {
      const exists = this.listas.some(lista => lista.id === this.activeListId);
      if (exists) {
        return this.activeListId;
      }
    }

    if (this.listas.length === 1) {
      return this.listas[0].id;
    }

    return TELEGRAM_ALL_PENDING_OPTION;
  }

  private buildAllList(): RecipeShoppingList {
    const grouped = new Map<string, ShoppingItem>();

    for (const lista of this.listas) {
      for (const item of lista.items) {
        const normalized = this.normalizeItemName(item.nombre);
        const amount = this.normalizeAmount(item.cantidad, item.unidad);
        const key = amount
          ? `${normalized}|${amount.unit}`
          : `${normalized}|${item.unidad ?? ''}|${item.id}`;
        const existing = grouped.get(key);
        const source = { listaId: lista.id, itemId: item.id };

        if (existing && amount) {
          existing.cantidad = (existing.cantidad ?? 0) + amount.value;
          existing.checked = existing.checked && item.checked;
          existing.sourceItems = [...(existing.sourceItems ?? []), source];
          continue;
        }

        grouped.set(key, {
          ...item,
          id: `all-${key}`,
          nombre: existing?.nombre ?? item.nombre,
          cantidad: amount?.value ?? item.cantidad,
          unidad: amount?.unit ?? item.unidad,
          checked: item.checked,
          sourceItems: [source],
        });
      }
    }

    return {
      id: VIEW_ALL_LIST_ID,
      recetaNombre: 'Ver Todo',
      grupoNombre: 'Todas las listas',
      items: Array.from(grouped.values()),
    };
  }

  private normalizeItemName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeAmount(cantidad: number | null, unidad: string | null): { value: number; unit: string } | null {
    if (cantidad === null || cantidad === undefined || !unidad) return null;

    const unit = this.stockUnitValue(unidad);
    if (unit === 'kg') return { value: cantidad * 1000, unit: 'g' };
    if (unit === 'lt') return { value: cantidad * 1000, unit: 'ml' };
    if (unit) return { value: cantidad, unit };
    return null;
  }

  private stockUnitValue(value: string | null | undefined): string | null {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const aliases: Record<string, string> = {
      '': 'unidad',
      unidad: 'unidad',
      unidades: 'unidad',
      u: 'unidad',
      g: 'g',
      gr: 'g',
      gramo: 'g',
      gramos: 'g',
      kg: 'kg',
      kilo: 'kg',
      kilos: 'kg',
      kilogramo: 'kg',
      kilogramos: 'kg',
      ml: 'ml',
      mililitro: 'ml',
      mililitros: 'ml',
      l: 'lt',
      lt: 'lt',
      litro: 'lt',
      litros: 'lt',
      cda: 'cda',
      cucharada: 'cda',
      cucharadas: 'cda',
      cdta: 'cdita',
      cdita: 'cdita',
      cucharadita: 'cdita',
      cucharaditas: 'cdita',
      taza: 'taza',
      tazas: 'taza',
      vaso: 'vaso',
      vasos: 'vaso',
      pizca: 'pizca',
    };

    if (!normalized) return null;
    return aliases[normalized] ?? value?.trim() ?? null;
  }

  private categoryIdFor(categoryName: string | null | undefined): string | null {
    if (!categoryName) return null;
    return this.categoriaIdByName.get(this.normalizeLookup(categoryName)) ?? null;
  }

  protected openCompareModal(prefillQuery?: string): void {
    this.showCompareModal = true;
    this.compareQuery = prefillQuery || '';
    this.compareResults = [];
    this.compareFailedScrapers = [];
    this.compareError = null;
    this.compareSuccessMessage = null;
    this.compareSearched = false;
    this.setScrollLock(true);
    this.cdr.markForCheck();
  }

  protected closeCompareModal(): void {
    this.showCompareModal = false;
    this.compareQuery = '';
    this.compareResults = [];
    this.compareFailedScrapers = [];
    this.compareError = null;
    this.compareSuccessMessage = null;
    this.compareSearched = false;
    this.setScrollLock(false);
    this.cdr.markForCheck();
  }

  private setScrollLock(locked: boolean): void {
    const mainEl = document.querySelector('main');
    if (locked) {
      document.body.classList.add('overflow-hidden');
      if (mainEl) {
        mainEl.classList.add('overflow-hidden');
      }
    } else {
      document.body.classList.remove('overflow-hidden');
      if (mainEl) {
        mainEl.classList.remove('overflow-hidden');
      }
    }
  }

  protected searchPrices(): void {
    const query = this.compareQuery.trim();
    if (!query) return;

    this.compareLoading = true;
    this.compareError = null;
    this.compareResults = [];
    this.compareFailedScrapers = [];
    this.cdr.markForCheck();

    this.comparadorApi.compararPrecios(query).subscribe({
      next: res => {
        this.compareResults = (res.products || []).sort((a, b) => a.price - b.price);
        this.compareFailedScrapers = res.failedScrapers || [];
        this.compareLoading = false;
        this.compareSearched = true;
        this.cdr.markForCheck();
      },
      error: error => {
        this.compareError = this.extractCompareErrorMessage(error);
        this.compareLoading = false;
        this.compareSearched = true;
        this.cdr.markForCheck();
      }
    });
  }

  private extractCompareErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const responseBody = (error as { error?: unknown }).error;
      if (typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody) {
        const message = (responseBody as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }
      }
    }

    return 'Ocurrió un error al buscar precios. Intentá de nuevo.';
  }

  protected addComparedProduct(productName: string): void {
    if (this.listas.length === 0) {
      this.compareError = 'No tenés ninguna lista de compras creada.';
      this.cdr.markForCheck();
      return;
    }

    this.selectedComparedProduct = productName;
    this.selectedAddToListTargetId = (this.activeListId && this.activeListId !== VIEW_ALL_LIST_ID)
      ? this.activeListId
      : this.listas[0].id;
    this.showCompareModal = false;
    this.showAddToListModal = true;
    this.cdr.markForCheck();
  }

  protected confirmAddComparedProduct(): void {
    if (!this.selectedAddToListTargetId || !this.selectedComparedProduct) {
      return;
    }

    const prodName = this.selectedComparedProduct;
    this.service.addItem(this.selectedAddToListTargetId, prodName, 1, 'unidad').subscribe({
      next: () => {
        this.compareSuccessMessage = `"${prodName}" agregado con éxito a la lista.`;
        this.showAddToListModal = false;
        this.showCompareModal = true;
        this.selectedComparedProduct = null;
        this.selectedAddToListTargetId = null;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.compareSuccessMessage = null;
          this.cdr.markForCheck();
        }, 3000);
      },
      error: () => {
        this.compareError = 'No se pudo agregar el producto a la lista.';
        this.showAddToListModal = false;
        this.showCompareModal = true;
        this.selectedComparedProduct = null;
        this.selectedAddToListTargetId = null;
        this.cdr.markForCheck();
      }
    });
  }

  protected closeAddToListModal(): void {
    this.showAddToListModal = false;
    this.showCompareModal = true;
    this.selectedComparedProduct = null;
    this.selectedAddToListTargetId = null;
    this.cdr.markForCheck();
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected getUnitLabel(unit: string | null | undefined): string {
    if (!unit) return 'unidad';
    const u = unit.toUpperCase();
    if (u === 'KG') return 'kg';
    if (u === 'LT') return 'lt';
    if (u === 'UN') return 'unidad';
    if (u === 'MT') return 'metro';
    return u.toLowerCase();
  }

  private normalizeLookup(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
