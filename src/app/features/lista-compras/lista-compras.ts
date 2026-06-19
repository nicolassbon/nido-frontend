import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ListaComprasService, RecipeShoppingList, ShoppingHistoryItem } from './lista-compras.service';

@Component({
  selector: 'app-lista-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterModule],
  templateUrl: './lista-compras.html',
})
export class ListaCompras implements OnInit, OnDestroy {
  protected readonly service = inject(ListaComprasService);
  private  readonly router   = inject(Router);
  private  readonly cdr      = inject(ChangeDetectorRef);

  protected listas:          RecipeShoppingList[] = [];
  protected historial:       ShoppingHistoryItem[] = [];
  protected totalPendiente:  number = 0;
  protected showAddForm = false;
  protected manualNombre = '';
  protected manualCantidad: number | null = null;
  protected manualUnidad = '';
  protected isSavingManual = false;
  protected errorMessage: string | null = null;

  private sub = new Subscription();

  constructor() {
    const nav   = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { recetaNombre?: string; items?: RecipeShoppingList['items'] } | undefined;
    if (state?.recetaNombre && state?.items?.length) {
      this.service.addToLista(state.recetaNombre, state.items);
    }
  }

  ngOnInit(): void {
    this.service.refresh().subscribe();
    this.service.refreshHistory().subscribe();

    this.sub.add(
      this.service.listas$.subscribe(listas => {
        this.listas = listas;
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.service.totalPendiente$.subscribe(n => {
        this.totalPendiente = n;
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.service.historial$.subscribe(historial => {
        this.historial = historial;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  protected toggleItem(recetaNombre: string, index: number): void {
    this.service.toggleItem(recetaNombre, index);
  }

  protected markPurchased(itemId: string): void {
    this.service.markPurchased(itemId).subscribe({
      error: () => {
        this.errorMessage = 'No se pudo marcar como comprado.';
        this.cdr.markForCheck();
      },
    });
  }

  protected removeItem(itemId: string): void {
    this.service.removeItem(itemId).subscribe({
      error: () => {
        this.errorMessage = 'No se pudo quitar el producto.';
        this.cdr.markForCheck();
      },
    });
  }

  protected clearAll(): void {
    this.service.clearAll().subscribe({
      error: () => {
        this.errorMessage = 'No se pudo vaciar la lista.';
        this.cdr.markForCheck();
      },
    });
  }

  protected toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.errorMessage = null;
  }

  protected addManualItem(): void {
    const nombre = this.manualNombre.trim();
    if (!nombre || this.isSavingManual) return;

    this.isSavingManual = true;
    this.errorMessage = null;
    this.service.addManualItem(nombre, this.manualCantidad, this.manualUnidad.trim() || null).subscribe({
      next: () => {
        this.manualNombre = '';
        this.manualCantidad = null;
        this.manualUnidad = '';
        this.showAddForm = false;
        this.isSavingManual = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'No se pudo agregar el producto.';
        this.isSavingManual = false;
        this.cdr.markForCheck();
      },
    });
  }

  protected goToRecetas(): void {
    this.router.navigate(['/recetas']);
  }

  protected pendientesDe(lista: RecipeShoppingList): number {
    return lista.items.filter(i => !i.checked).length;
  }

  protected formatAmount(cantidad: number | null, unidad: string | null): string {
    if (!cantidad && !unidad) return '';
    if (!cantidad)            return unidad ?? '';
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
}
