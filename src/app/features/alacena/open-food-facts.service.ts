import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NutritionInfoResponse } from './alacena-api.service';

export interface FoodProduct {
  name:              string;
  image:             string;
  brands:            string;
  categoriesTags:    string[];
  /** Categoría canónica de Nido sugerida por el back: General, Lácteos, Bebidas, Congelados, Despensa. */
  categoriaSugerida: string;
  foundInDb:         boolean;
  /** Información nutricional por 100 g (puede venir null si la fuente no la provee). */
  calorias:          number | null;
  proteinas:         number | null;
  carbohidratos:     number | null;
  grasas:            number | null;
  informacionNutricional?: NutritionInfoResponse | null;
  /** Gramaje extraído del nombre del producto (ej: 290 de "Producto 290g"). */
  gramajeExtraido:   number | null;
}

/**
 * Resuelve un código de barras a datos del producto.
 *
 * La lógica de consultar fuentes externas (Open Food Facts mundial / Argentina /
 * UPC Item DB en cascada) vive en el backend, en
 * `GET /api/productos/external-lookup/{barcode}`. El back centraliza:
 *   - el manejo de timeouts y errores de las APIs externas
 *   - el header User-Agent requerido por Open Food Facts
 *   - posibilidad de cachear los resultados a futuro
 *
 * Este servicio mantiene la misma interfaz pública que tenía la versión
 * anterior (`lookup(barcode): Observable<FoodProduct>`) por compatibilidad
 * con los componentes que ya lo consumen.
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  lookup(barcode: string): Observable<FoodProduct> {
    const url = `${this.baseUrl}/productos/external-lookup/${encodeURIComponent(barcode)}`;
    return this.http.get<FoodProduct>(url).pipe(
      catchError(() => of(this.emptyProduct())),
    );
  }

  private emptyProduct(): FoodProduct {
    return {
      name: '', image: '', brands: '', categoriesTags: [], categoriaSugerida: 'General', foundInDb: false,
      calorias: null, proteinas: null, carbohidratos: null, grasas: null, informacionNutricional: null, gramajeExtraido: null,
    };
  }
}
