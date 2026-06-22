import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TicketScanItem {
  productName: string;
  quantity: number;
  unitPrice: number | null;
}

export interface TicketScanResponse {
  merchantName: string | null;
  items: TicketScanItem[];
}

@Injectable({ providedIn: 'root' })
export class TicketScanService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  scan(file: File): Observable<TicketScanResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TicketScanResponse>(`${this.base}/tickets/scan`, formData);
  }
}
