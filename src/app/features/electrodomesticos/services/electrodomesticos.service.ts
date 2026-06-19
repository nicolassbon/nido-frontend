import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Electrodomestico {
  id: string;
  hogarId: string;
  nombre: string;
  tipo: string | null;
  estado: string | null;
  imagenUrl: string | null;
  marca: string | null;
  catalogoId?: string | null;
}

export interface CrearElectrodomesticoRequest {
  hogarId?: string;
  catalogoId?: string | null;
  nombre: string;
  tipo?: string | null;
  estado?: string | null;
  marca?: string | null;
  imagenUrl?: string | null;
}

interface ApiElectrodomestico {
  id: string;
  hogarId: string;
  nombre: string;
  tipo: string | null;
  estado: string | null;
  marca: string | null;
  ImagenUrl?: string | null;
  imagenUrl?: string | null;
  catalogoId?: string | null;
  CatalogoId?: string | null;
}

export interface ElectrodomesticoCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  icono: string | null;
  imagenUrl: string | null;
  orden: number;
}



@Injectable({
  providedIn: 'root',
})
export class ElectrodomesticosService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  private normalize(item: ApiElectrodomestico): Electrodomestico {
    return {
      id: item.id,
      hogarId: item.hogarId,
      nombre: item.nombre,
      tipo: item.tipo,
      estado: item.estado,
      marca: item.marca,
      imagenUrl: item.imagenUrl ?? item.ImagenUrl ?? null,
      catalogoId: item.catalogoId ?? item.CatalogoId ?? null,
    };
  }

  getAll(): Observable<Electrodomestico[]> {
    return this.http
      .get<ApiElectrodomestico[]>(`${this.apiBaseUrl}/electrodomesticos`)
      .pipe(map((items) => items.map((item) => this.normalize(item))));
  }

  add(body: CrearElectrodomesticoRequest): Observable<Electrodomestico> {
    return this.http
      .post<ApiElectrodomestico>(`${this.apiBaseUrl}/electrodomesticos`, body)
      .pipe(map((item) => this.normalize(item)));
  }

  getCatalogo(): Observable<ElectrodomesticoCatalogo[]> {
  return this.http.get<ElectrodomesticoCatalogo[]>(
    `${this.apiBaseUrl}/electrodomesticos/catalogo`
  );
}
}
