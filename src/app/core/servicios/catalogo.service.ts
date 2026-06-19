import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';

export interface CategoriaDto {
  id:      string;
  nombre:  string;
  ttlDias: number | null;
}

export interface UnidadMedidaDto {
  id:     string;
  codigo: string;
  nombre: string;
}

export interface UbicacionDto {
  id:    string;
  nombre: string;
  icono: string | null;
  color: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private _categorias$?: Observable<CategoriaDto[]>;
  private _unidades$?:   Observable<UnidadMedidaDto[]>;
  private _ubicaciones$?: Observable<UbicacionDto[]>;

  getCategorias(): Observable<CategoriaDto[]> {
    this._categorias$ ??= this.http
      .get<CategoriaDto[]>(`${this.base}/alacena/categorias`)
      .pipe(shareReplay(1));
    return this._categorias$;
  }

  getUnidadesMedida(): Observable<UnidadMedidaDto[]> {
    this._unidades$ ??= this.http
      .get<UnidadMedidaDto[]>(`${this.base}/alacena/unidades-medida`)
      .pipe(shareReplay(1));
    return this._unidades$;
  }

  getUbicaciones(): Observable<UbicacionDto[]> {
    this._ubicaciones$ ??= this.http
      .get<UbicacionDto[]>(`${this.base}/alacena/ubicaciones`)
      .pipe(shareReplay(1));
    return this._ubicaciones$;
  }

  /** Helper: convierte CategoriaDto[] → NidoSelectOption[] */
  static toCategoriasOpts(cats: CategoriaDto[]): NidoSelectOption[] {
    return cats.map(c => ({ value: c.id, label: c.nombre }));
  }

  /** Helper: convierte UnidadMedidaDto[] → NidoSelectOption[] */
  static toUnidadesOpts(units: UnidadMedidaDto[]): NidoSelectOption[] {
    return units.map(u => ({ value: u.codigo, label: u.nombre }));
  }
}
