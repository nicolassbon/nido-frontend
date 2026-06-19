import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ShoppingItem {
  id:         string;
  productoId: string;
  nombre:    string;
  cantidad:  number | null;
  unidad:    string | null;
  checked:   boolean;
  compradoEn?: string | null;
  orden?:     number;
}

export interface RecipeShoppingList {
  recetaNombre: string;
  grupoNombre?: string;
  items:        ShoppingItem[];
}

export interface ShoppingHistoryItem {
  id:          string;
  productoId:  string;
  nombre:      string;
  cantidad:    number | null;
  unidad:      string | null;
  grupoNombre: string;
  compradoEn:  string;
  compradoPor: string | null;
}

type AddItemInput = {
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
};

const STORAGE_KEY = 'nido_listas_compras';
const MIGRATION_FLAG = 'nido_listas_compras_migrated_to_api';
const MANUAL_GROUP = 'Productos agregados';

@Injectable({ providedIn: 'root' })
export class ListaComprasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/lista-compras`;

  private readonly _listas$ = new BehaviorSubject<RecipeShoppingList[]>([]);
  private readonly _historial$ = new BehaviorSubject<ShoppingHistoryItem[]>([]);

  readonly listas$ = this._listas$.asObservable();
  readonly historial$ = this._historial$.asObservable();
  readonly totalPendiente$ = this._listas$.pipe(
    map(listas => listas.reduce((acc, l) => acc + l.items.filter(i => !i.checked).length, 0)),
  );

  constructor() {
    this.migrateLegacyStorage();
    this.refresh().subscribe();
    this.refreshHistory().subscribe();
  }

  get snapshot(): RecipeShoppingList[] {
    return this._listas$.value;
  }

  get historySnapshot(): ShoppingHistoryItem[] {
    return this._historial$.value;
  }

  refresh() {
    return this.http.get<ApiShoppingGroup[]>(this.baseUrl).pipe(
      map(groups => groups.map(toShoppingList)),
      tap(groups => this._listas$.next(groups)),
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

  addGroupToLista(recetaNombre: string, faltantes: AddItemInput[]) {
    return this.http.post<ApiShoppingGroup[]>(`${this.baseUrl}/grupos`, {
      grupoNombre: recetaNombre,
      items: faltantes.map(item => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        unidad: item.unidad,
      })),
    }).pipe(
      map(groups => groups.map(toShoppingList)),
      tap(groups => this._listas$.next(groups)),
    );
  }

  addToLista(recetaNombre: string, faltantes: AddItemInput[]): void {
    this.addGroupToLista(recetaNombre, faltantes).subscribe();
  }

  addManualItem(nombre: string, cantidad: number | null, unidad: string | null) {
    return this.http.post<ApiShoppingItem>(`${this.baseUrl}/items`, {
      nombre,
      cantidad,
      unidad,
      grupoNombre: MANUAL_GROUP,
    }).pipe(
      switchMap(() => this.refresh()),
    );
  }

  markPurchased(itemId: string) {
    return this.http.patch<ApiShoppingItem>(`${this.baseUrl}/items/${encodeURIComponent(itemId)}/comprado`, {}).pipe(
      switchMap(() => this.refresh()),
      tap(() => this.refreshHistory().subscribe()),
    );
  }

  toggleItem(recetaNombre: string, itemIndex: number): void {
    const item = this.snapshot.find(l => l.recetaNombre === recetaNombre)?.items[itemIndex];
    if (!item || item.checked) return;
    this.markPurchased(item.id).subscribe();
  }

  marcarCompradoPorNombre(nombre: string): void {
    const trimmed = nombre.trim();
    if (!trimmed) return;

    this.http.patch<ApiShoppingItem[]>(`${this.baseUrl}/items/comprado-por-nombre`, { nombre: trimmed }).pipe(
      switchMap(() => this.refresh()),
      tap(() => this.refreshHistory().subscribe()),
      catchError(() => of([])),
    ).subscribe();
  }

  removeItem(itemId: string) {
    return this.http.delete<void>(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`).pipe(
      switchMap(() => this.refresh()),
    );
  }

  removeRecetaLista(recetaNombre: string): void {
    const group = this.snapshot.find(lista => lista.recetaNombre === recetaNombre);
    if (!group) return;

    forkJoin(group.items.map(item => this.http.delete<void>(`${this.baseUrl}/items/${encodeURIComponent(item.id)}`))).pipe(
      switchMap(() => this.refresh()),
      catchError(() => of([])),
    ).subscribe();
  }

  clearAll() {
    return this.http.delete<void>(this.baseUrl).pipe(
      tap(() => this._listas$.next([])),
      switchMap(() => this.refreshHistory()),
    );
  }

  private migrateLegacyStorage(): void {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    let legacy: Array<{ recetaNombre: string; items: AddItemInput[] }> = [];
    try {
      legacy = JSON.parse(raw);
    } catch {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    const valid = legacy.filter(lista => lista.recetaNombre && Array.isArray(lista.items) && lista.items.length > 0);
    if (valid.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    forkJoin(valid.map(lista => this.addGroupToLista(lista.recetaNombre, lista.items))).pipe(
      switchMap(() => this.refresh()),
      tap(() => {
        localStorage.setItem(MIGRATION_FLAG, 'true');
        localStorage.removeItem(STORAGE_KEY);
      }),
      catchError(() => of([])),
    ).subscribe();
  }
}

interface ApiShoppingGroup {
  grupoNombre: string;
  items: ApiShoppingItem[];
}

interface ApiShoppingItem {
  id: string;
  productoId: string;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  comprado: boolean;
  compradoEn: string | null;
  orden: number;
}

interface ApiHistoryItem {
  id: string;
  productoId: string;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  grupoNombre: string;
  compradoEn: string;
  compradoPor: string | null;
}

function toShoppingList(group: ApiShoppingGroup): RecipeShoppingList {
  return {
    recetaNombre: group.grupoNombre,
    grupoNombre: group.grupoNombre,
    items: group.items.map(item => ({
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

