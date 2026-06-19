import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ShoppingItem {
  id: string;
  productoId: string | null;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  checked: boolean;
  compradoEn?: string | null;
  orden?: number;
}

export interface RecipeShoppingList {
  id: string;
  recetaNombre: string;
  grupoNombre?: string;
  items: ShoppingItem[];
}

export interface ShoppingHistoryItem {
  id: string;
  productoId: string | null;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  grupoNombre: string;
  compradoEn: string;
  compradoPor: string | null;
}

type AddItemInput = {
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
};

@Injectable({ providedIn: 'root' })
export class ListaComprasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/listas-compra`;
  private readonly legacyBaseUrl = `${environment.apiBaseUrl}/lista-compras`;

  private readonly _listas$ = new BehaviorSubject<RecipeShoppingList[]>([]);
  private readonly _historial$ = new BehaviorSubject<ShoppingHistoryItem[]>([]);

  readonly listas$ = this._listas$.asObservable();
  readonly historial$ = this._historial$.asObservable();
  readonly totalPendiente$ = this._listas$.pipe(
    map(listas => listas.reduce((acc, l) => acc + l.items.filter(i => !i.checked).length, 0)),
  );

  constructor() {
    this.refresh().subscribe();
    this.refreshHistory().subscribe();
  }

  get snapshot(): RecipeShoppingList[] {
    return this._listas$.value;
  }

  refresh() {
    return this.http.get<ApiShoppingList[]>(this.baseUrl).pipe(
      map(lists => lists.map(toShoppingList)),
      tap(lists => this._listas$.next(lists)),
      catchError(() => {
        this._listas$.next([]);
        return of([]);
      }),
    );
  }

  refreshHistory() {
    return this.http.get<ApiHistoryItem[]>(`${this.baseUrl}/historial`).pipe(
      map(items => items.map(toHistoryItem)),
      tap(items => this._historial$.next(items)),
      catchError(() => {
        this._historial$.next([]);
        return of([]);
      }),
    );
  }

  createList(nombre: string) {
    return this.http.post<ApiShoppingList>(this.baseUrl, { nombre }).pipe(
      switchMap(() => this.refresh()),
    );
  }

  updateList(id: string, nombre: string) {
    return this.http.patch<ApiShoppingList>(`${this.baseUrl}/${encodeURIComponent(id)}`, { nombre }).pipe(
      switchMap(() => this.refresh()),
    );
  }

  deleteList(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`).pipe(
      switchMap(() => this.refresh()),
    );
  }

  addItem(listaId: string, nombre: string, cantidad: number | null, unidad: string | null) {
    return this.http.post<ApiShoppingItem>(`${this.baseUrl}/${encodeURIComponent(listaId)}/items`, {
      nombre,
      cantidad,
      unidad,
    }).pipe(
      switchMap(() => this.refresh()),
    );
  }

  addManualItem(nombre: string, cantidad: number | null, unidad: string | null) {
    const target = this.snapshot[0];
    if (target) {
      return this.addItem(target.id, nombre, cantidad, unidad);
    }

    return this.createList('Principal').pipe(
      switchMap(listas => {
        const created = listas[0];
        return created ? this.addItem(created.id, nombre, cantidad, unidad) : of([]);
      }),
    );
  }

  updateItem(
    listaId: string,
    itemId: string,
    changes: { nombre?: string; cantidad?: number | null; unidad?: string | null; comprado?: boolean },
  ) {
    return this.http.patch<ApiShoppingItem>(
      `${this.baseUrl}/${encodeURIComponent(listaId)}/items/${encodeURIComponent(itemId)}`,
      changes,
    ).pipe(
      switchMap(() => this.refresh()),
      tap(() => {
        if (changes.comprado !== undefined) this.refreshHistory().subscribe();
      }),
    );
  }

  markPurchased(listaId: string, itemId: string, comprado = true) {
    return this.updateItem(listaId, itemId, { comprado });
  }

  removeItem(listaId: string, itemId: string) {
    return this.http.delete<void>(
      `${this.baseUrl}/${encodeURIComponent(listaId)}/items/${encodeURIComponent(itemId)}`,
    ).pipe(
      switchMap(() => this.refresh()),
    );
  }

  addGroupToLista(recetaNombre: string, faltantes: AddItemInput[]) {
    return this.http.post<ApiShoppingList>(this.baseUrl, { nombre: recetaNombre }).pipe(
      switchMap(lista => {
        const requests = faltantes.map(item =>
          this.http.post<ApiShoppingItem>(`${this.baseUrl}/${encodeURIComponent(lista.id)}/items`, item),
        );
        return requests.length > 0 ? forkJoin(requests) : of([]);
      }),
      switchMap(() => this.refresh()),
    );
  }

  addToLista(recetaNombre: string, faltantes: AddItemInput[]): void {
    this.addGroupToLista(recetaNombre, faltantes).subscribe();
  }

  marcarCompradoPorNombre(nombre: string): void {
    const trimmed = nombre.trim();
    if (!trimmed) return;

    this.http.patch<ApiShoppingItem[]>(`${this.legacyBaseUrl}/items/comprado-por-nombre`, { nombre: trimmed }).pipe(
      switchMap(() => this.refresh()),
      tap(() => this.refreshHistory().subscribe()),
      catchError(() => of([])),
    ).subscribe();
  }
}

interface ApiShoppingList {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt: string | null;
  items: ApiShoppingItem[];
}

interface ApiShoppingItem {
  id: string;
  productoId: string | null;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  comprado: boolean;
  compradoEn: string | null;
  orden: number;
}

interface ApiHistoryItem {
  id: string;
  productoId: string | null;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  grupoNombre: string;
  compradoEn: string;
  compradoPor: string | null;
}

function toShoppingList(list: ApiShoppingList): RecipeShoppingList {
  return {
    id: list.id,
    recetaNombre: list.nombre,
    grupoNombre: list.nombre,
    items: list.items.map(item => ({
      id: item.id,
      productoId: item.productoId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      unidad: item.unidad,
      checked: item.comprado,
      compradoEn: item.compradoEn,
      orden: item.orden,
    })),
  };
}

function toHistoryItem(item: ApiHistoryItem): ShoppingHistoryItem {
  return {
    id: item.id,
    productoId: item.productoId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    unidad: item.unidad,
    grupoNombre: item.grupoNombre,
    compradoEn: item.compradoEn,
    compradoPor: item.compradoPor,
  };
}
