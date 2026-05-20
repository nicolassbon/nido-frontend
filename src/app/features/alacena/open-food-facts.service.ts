import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, switchMap } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface FoodProduct {
  name:           string;
  image:          string;
  brands:         string;
  categoriesTags: string[];
  foundInDb:      boolean;
}

// ── Open Food Facts ───────────────────────────────────────────────────────────

interface OFFApiResponse {
  status: number;
  product?: {
    product_name_es?: string;
    product_name?:    string;
    product_name_en?: string;
    image_front_url?: string;
    image_url?:       string;
    brands?:          string;
    categories_tags?: string[];
  };
}

// ── UPC Item DB ───────────────────────────────────────────────────────────────
// Free tier: 100 req/day, no API key required.
// Covers EAN-13 and UPC-A globally, including many Latin American products.

interface UPCItemDBResponse {
  code:   string;
  total:  number;
  items?: Array<{
    ean:      string;
    title:    string;
    brand:    string;
    images?:  string[];
    category: string;
  }>;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OpenFoodFactsService {
  private readonly http = inject(HttpClient);

  /**
   * Resolves a barcode to product data querying three sources in order:
   *   1. Open Food Facts (global)
   *   2. Open Food Facts Argentina — better coverage for local brands
   *   3. UPC Item DB              — broad EAN-13/UPC-A coverage
   *
   * The cascade continues to the next source whenever the current one returns
   * a result with no name (common for poorly-catalogued products). If a source
   * returns null the previous result (which may still have categories/image) is
   * preserved as a fallback — so TTL estimation still works even without a name.
   *
   * Always resolves. Returns `foundInDb: false` only when no source recognises
   * the barcode at all.
   */
  lookup(barcode: string): Observable<FoodProduct> {
    return this.fetchFromOFF('https://world.openfoodfacts.org', barcode).pipe(
      // Try OFF Argentina if world had no name
      switchMap(p => p?.name
        ? of(p)
        : this.fetchFromOFF('https://ar.openfoodfacts.org', barcode).pipe(
            map(p2 => p2 ?? p),   // keep world result (categories) if AR also null
          ),
      ),
      // Try UPC Item DB if still no name
      switchMap(p => p?.name
        ? of(p)
        : this.fetchFromUPCItemDB(barcode).pipe(
            map(p2 => p2 ?? p),   // keep previous result (categories) if UPC also null
          ),
      ),
      map(p => p ?? this.emptyProduct()),
      catchError(() => of(this.emptyProduct())),
    );
  }

  // ── Private: OFF ─────────────────────────────────────────

  private fetchFromOFF(baseUrl: string, barcode: string): Observable<FoodProduct | null> {
    const url = `${baseUrl}/api/v0/product/${encodeURIComponent(barcode)}.json`;
    return this.http.get<OFFApiResponse>(url).pipe(
      map(res => {
        if (res.status !== 1 || !res.product) return null;
        const p = res.product;
        return {
          name:           this.sanitizeName(p.product_name_es || p.product_name || p.product_name_en || ''),
          image:          p.image_front_url || p.image_url || '',
          brands:         p.brands || '',
          categoriesTags: p.categories_tags ?? [],
          foundInDb:      true,
        };
      }),
      catchError(() => of(null)),
    );
  }

  // ── Private: UPC Item DB ──────────────────────────────────

  private fetchFromUPCItemDB(barcode: string): Observable<FoodProduct | null> {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
    return this.http.get<UPCItemDBResponse>(url).pipe(
      map(res => {
        if (res.code !== 'OK' || !res.items?.length) return null;
        const item = res.items[0];
        return {
          name:           this.sanitizeName(item.title || ''),
          image:          item.images?.[0] || '',
          brands:         item.brand || '',
          categoriesTags: this.parseCategoryString(item.category || ''),
          foundInDb:      true,
        };
      }),
      catchError(() => of(null)),
    );
  }

  // ── Private helpers ───────────────────────────────────────

  /**
   * Returns empty string when the name is just a barcode number (8–14 digits),
   * which happens with poorly-catalogued products where the barcode was used
   * as a placeholder name.
   */
  private sanitizeName(raw: string): string {
    const trimmed = raw.trim();
    return /^\d{8,14}$/.test(trimmed) ? '' : trimmed;
  }

  /**
   * "Food & Grocery > Dairy > Spreads" → ['en:food-grocery', 'en:dairy', 'en:spreads']
   */
  private parseCategoryString(category: string): string[] {
    return category
      .split('>')
      .map(s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean)
      .map(s => `en:${s}`);
  }

  private emptyProduct(): FoodProduct {
    return { name: '', image: '', brands: '', categoriesTags: [], foundInDb: false };
  }
}
