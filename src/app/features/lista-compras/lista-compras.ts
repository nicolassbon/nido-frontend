import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem, ShoppingItem } from './lista-compras.service';

@Component({
  selector: 'app-lista-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterModule],
  templateUrl: './lista-compras.html',
})
export class ListaCompras implements OnInit, OnDestroy {
  protected readonly service = inject(ListaComprasService);
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

    this.sub.add(this.service.listas$.subscribe(listas => {
      this.listas = listas;
      if (!this.activeListId || !listas.some(lista => lista.id === this.activeListId)) {
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
    const request = this.editingListId
      ? this.service.updateList(this.editingListId, nombre)
      : this.service.createList(nombre);

    request.subscribe({
      next: () => {
        this.showListForm = false;
        this.editingListId = null;
        this.listName = '';
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
    this.service.markPurchased(listaId, item.id, !item.checked).subscribe({
      error: () => this.fail('No se pudo actualizar el producto.'),
    });
  }

  protected removeItem(listaId: string, itemId: string, event: Event): void {
    event.stopPropagation();
    this.service.removeItem(listaId, itemId).subscribe({
      error: () => this.fail('No se pudo quitar el producto.'),
    });
  }

  protected activeList(): RecipeShoppingList | null {
    return this.listas.find(lista => lista.id === this.activeListId) ?? this.listas[0] ?? null;
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
    this.isSaving = false;
    this.cdr.markForCheck();
  }
}
