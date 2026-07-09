import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ComparedProduct {
  id: string;
  source: string;
  name: string;
  link: string;
  image: string;
  price: number;
  unit: string;
  unitPrice: number;
}

export interface ComparePricesResponse {
  products: ComparedProduct[];
  failedScrapers: string[];
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ComparadorApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  compararPrecios(query: string): Observable<ComparePricesResponse> {
    return this.http.get<ComparePricesResponse>(
      `${this.base}/productos/comparar`,
      { params: { q: query } }
    );
  }
}
