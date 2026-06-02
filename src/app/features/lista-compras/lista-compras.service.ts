import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ShoppingItem {
  nombre:   string;
  cantidad: number | null;
  unidad:   string | null;
  checked:  boolean;
}

export interface RecipeShoppingList {
  recetaNombre: string;
  items:        ShoppingItem[];
}

const STORAGE_KEY = 'nido_listas_compras';

@Injectable({ providedIn: 'root' })
export class ListaComprasService {

  private readonly _listas$ = new BehaviorSubject<RecipeShoppingList[]>(this.loadFromStorage());

  readonly listas$        = this._listas$.asObservable();
  readonly totalPendiente$ = this._listas$.pipe(
    map(listas => listas.reduce((acc, l) => acc + l.items.filter(i => !i.checked).length, 0))
  );

  get snapshot(): RecipeShoppingList[] {
    return this._listas$.value;
  }

  addToLista(recetaNombre: string, faltantes: { nombre: string; cantidad: number | null; unidad: string | null }[]): void {
    const nueva: RecipeShoppingList = {
      recetaNombre,
      items: faltantes.map(f => ({ nombre: f.nombre, cantidad: f.cantidad, unidad: f.unidad, checked: false })),
    };
    const updated = [...this._listas$.value.filter(l => l.recetaNombre !== recetaNombre), nueva];
    this._listas$.next(updated);
    this.saveToStorage(updated);
  }

  toggleItem(recetaNombre: string, itemIndex: number): void {
    const updated = this._listas$.value.map(l => {
      if (l.recetaNombre !== recetaNombre) return l;
      return {
        ...l,
        items: l.items.map((item, i) => i === itemIndex ? { ...item, checked: !item.checked } : item),
      };
    });
    this._listas$.next(updated);
    this.saveToStorage(updated);
  }

  marcarCompradoPorNombre(nombre: string): void {
    const nombreNorm = nombre.trim().toLowerCase();
    const updated = this._listas$.value.map(lista => ({
      ...lista,
      items: lista.items.map(item => {
        if (item.checked) return item;
        const itemNorm = item.nombre.trim().toLowerCase();
        const coincide = itemNorm.includes(nombreNorm) || nombreNorm.includes(itemNorm);
        return coincide ? { ...item, checked: true } : item;
      }),
    }));
    this._listas$.next(updated);
    this.saveToStorage(updated);
  }

  removeRecetaLista(recetaNombre: string): void {
    const updated = this._listas$.value.filter(l => l.recetaNombre !== recetaNombre);
    this._listas$.next(updated);
    this.saveToStorage(updated);
  }

  clearAll(): void {
    this._listas$.next([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveToStorage(listas: RecipeShoppingList[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listas));
  }

  private loadFromStorage(): RecipeShoppingList[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
