import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TelegramPairingResponse {
  deepLinkUrl: string;
  pairingCode: string;
  expiresAt: string;
}

export interface TelegramPairingStatusResponse {
  isLinked: boolean;
  chatId?: number;
  pairedAt?: string;
}

export interface UnlinkTelegramChatResponse {
  chatId: number;
  unpairedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TelegramApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  startPairing(): Observable<TelegramPairingResponse> {
    return this.http.post<TelegramPairingResponse>(`${this.base}/telegram/pairing/start`, {});
  }

  getStatus(): Observable<TelegramPairingStatusResponse> {
    return this.http.get<TelegramPairingStatusResponse>(`${this.base}/telegram/pairing/status`);
  }

  unlink(): Observable<UnlinkTelegramChatResponse> {
    return this.http.post<UnlinkTelegramChatResponse>(`${this.base}/telegram/pairing/unlink`, {});
  }
}
