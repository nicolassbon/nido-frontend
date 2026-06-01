import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ListaComprasService, RecipeShoppingList } from './lista-compras.service';

@Component({
  selector: 'app-lista-compras',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterModule],
  templateUrl: './lista-compras.html',
})
export class ListaCompras implements OnInit, OnDestroy {
  protected readonly service = inject(ListaComprasService);
  private  readonly router   = inject(Router);
  private  readonly cdr      = inject(ChangeDetectorRef);

  protected listas:          RecipeShoppingList[] = [];
  protected totalPendiente:  number = 0;

  private sub = new Subscription();

  constructor() {
    const nav   = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { recetaNombre?: string; items?: RecipeShoppingList['items'] } | undefined;
    if (state?.recetaNombre && state?.items?.length) {
      this.service.addToLista(state.recetaNombre, state.items);
    }
  }

  ngOnInit(): void {
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
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  protected toggleItem(recetaNombre: string, index: number): void {
    this.service.toggleItem(recetaNombre, index);
  }

  protected removeReceta(recetaNombre: string): void {
    this.service.removeRecetaLista(recetaNombre);
  }

  protected clearAll(): void {
    this.service.clearAll();
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
}
