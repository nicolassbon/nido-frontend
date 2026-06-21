import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem, ShoppingItem } from './lista-compras.service';
import { CatalogoService } from '../../core/servicios/catalogo.service';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { AlacenaApiService, CreateStockItemRequest } from '../alacena/alacena-api.service';

const VIEW_ALL_LIST_ID = '__ver_todo__';

@Component({
  selector: 'app-lista-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterModule, NidoSelectComponent],
  templateUrl: './lista-compras.html',
})
export class ListaCompras implements OnInit, OnDestroy {
  protected readonly service = inject(ListaComprasService);
  private readonly catalogoService = inject(CatalogoService);
  private readonly alacenaApi = inject(AlacenaApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected listas: RecipeShoppingList[] = [];
  protected historial: ShoppingHistoryItem[] = [];
  protected totalPendiente = 0;
  protected errorMessage: string | null = null;

  protected showListForm = false;
  protected listName = '';
  protected editingListId: string | null = null;

  protected activeListId: string | null = null;
  protected itemNombre = '';
  protected itemCantidad: number | null = null;
  protected itemUnidad = '';
  protected editingItem: { listaId: string; itemId: string } | null = null;
  protected isSaving = false;
  protected unidadesOpts: NidoSelectOption[] = [];
  protected uploadingHistoryId: string | null = null;

  private sub = new Subscription();

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
    this.cancelItemEdit();
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
    this.itemUnidad = item.unidad ?? '';
  }

  protected cancelItemEdit(): void {
    this.editingItem = null;
    this.itemNombre = '';
    this.itemCantidad = null;
    this.itemUnidad = '';
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
    if (this.uploadingHistoryId) return;

    this.errorMessage = null;
    this.uploadingHistoryId = item.id;
    this.cdr.markForCheck();

    const payload: CreateStockItemRequest = {
      nombre: item.nombre,
      categoriaId: null,
      codigoBarras: null,
      imagen: null,
      ubicacion: 'Alacena',
      cantidad: item.cantidad && item.cantidad > 0 ? item.cantidad : 1,
      unidadMedida: this.stockUnitValue(item.unidad),
      fechaVencimiento: null,
      estaAbierto: false,
      porcentajeConsumido: 0,
      origenCarga: 'ticket_compra',
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
            this.fail('Se agrego a la alacena, pero no se pudo quitar del historial.');
          },
        });
      },
      error: () => {
        this.uploadingHistoryId = null;
        this.fail('No se pudo pasar el producto a la alacena.');
      },
    });
  }

  protected activeList(): RecipeShoppingList | null {
    if (this.activeListId === VIEW_ALL_LIST_ID) {
      return this.buildAllList();
    }

    return this.listas.find(lista => lista.id === this.activeListId) ?? this.listas[0] ?? null;
  }

  protected isViewingAll(): boolean {
    return this.activeListId === VIEW_ALL_LIST_ID;
  }

  protected goToRecetas(): void {
    this.router.navigate(['/recetas']);
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

  private fail(message: string): void {
    this.errorMessage = message;
    this.uploadingHistoryId = null;
    this.isSaving = false;
    this.cdr.markForCheck();
  }

  private buildAllList(): RecipeShoppingList {
    const groups = new Map<string, {
      nombre: string;
      unidad: string | null;
      cantidad: number;
      hasCantidad: boolean;
      sourceItems: Array<{ listaId: string; itemId: string }>;
      firstOrden: number;
    }>();

    for (const lista of this.listas) {
      for (const item of lista.items) {
        if (item.checked) continue;

        const unit = unitMergeInfo(item.unidad);
        const nameKey = normalizeName(item.nombre);
        const key = unit.canMerge ? `${nameKey}|${unit.kind}` : `${nameKey}|custom|${item.id}`;
        const current = groups.get(key);

        if (!current) {
          groups.set(key, {
            nombre: item.nombre,
            unidad: unit.canonicalUnit,
            cantidad: item.cantidad == null ? 0 : item.cantidad * unit.factor,
            hasCantidad: item.cantidad != null,
            sourceItems: [{ listaId: lista.id, itemId: item.id }],
            firstOrden: item.orden ?? groups.size,
          });
          continue;
        }

        if (item.cantidad != null) {
          current.cantidad += item.cantidad * unit.factor;
          current.hasCantidad = true;
        }
        current.sourceItems.push({ listaId: lista.id, itemId: item.id });
      }
    }

    const items: ShoppingItem[] = [...groups.entries()]
      .map(([key, group]) => ({
        id: key,
        productoId: null,
        nombre: group.nombre,
        cantidad: group.hasCantidad ? group.cantidad : null,
        unidad: group.unidad,
        checked: false,
        orden: group.firstOrden,
        sourceItems: group.sourceItems,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return {
      id: VIEW_ALL_LIST_ID,
      recetaNombre: 'Ver Todo',
      grupoNombre: 'Ver Todo',
      items,
    };
  }

  private stockUnitValue(value: string | null | undefined): string | null {
    const normalized = normalizeName(value ?? '');
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
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function unitMergeInfo(value: string | null): {
  kind: string;
  canonicalUnit: string | null;
  factor: number;
  canMerge: boolean;
} {
  const normalized = normalizeName(value ?? '');

  switch (normalized) {
    case '':
    case 'u':
    case 'unidad':
    case 'unidades':
    case 'unit':
      return { kind: 'unit', canonicalUnit: 'unidad', factor: 1, canMerge: true };
    case 'g':
    case 'gr':
    case 'gramo':
    case 'gramos':
      return { kind: 'mass', canonicalUnit: 'g', factor: 1, canMerge: true };
    case 'kg':
    case 'kilo':
    case 'kilos':
    case 'kilogramo':
    case 'kilogramos':
      return { kind: 'mass', canonicalUnit: 'g', factor: 1000, canMerge: true };
    case 'ml':
    case 'mililitro':
    case 'mililitros':
      return { kind: 'volume', canonicalUnit: 'ml', factor: 1, canMerge: true };
    case 'l':
    case 'lt':
    case 'litro':
    case 'litros':
      return { kind: 'volume', canonicalUnit: 'ml', factor: 1000, canMerge: true };
    default:
      return { kind: `custom:${normalized}`, canonicalUnit: value?.trim() || null, factor: 1, canMerge: false };
  }
}
