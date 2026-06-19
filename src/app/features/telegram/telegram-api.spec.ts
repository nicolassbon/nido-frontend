import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import {
  TelegramApiService,
  type TelegramPairingResponse,
  type TelegramPairingStatusResponse,
  type UnlinkTelegramChatResponse,
} from './telegram-api';

describe('TelegramApiService', () => {
  let service: TelegramApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TelegramApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs to start telegram pairing', () => {
    const response: TelegramPairingResponse = {
      deepLinkUrl: 'https://t.me/nido_bot?start=abc123',
      pairingCode: 'ABC123',
      expiresAt: '2026-06-19T12:00:00.000Z',
    };

    service.startPairing().subscribe(result => expect(result).toEqual(response));

    const req = http.expectOne(`${environment.apiBaseUrl}/telegram/pairing/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(response);
  });

  it('GETs telegram pairing status', () => {
    const response: TelegramPairingStatusResponse = {
      isLinked: true,
      chatId: 12345,
      pairedAt: '2026-06-19T12:00:00.000Z',
    };

    service.getStatus().subscribe(result => expect(result).toEqual(response));

    const req = http.expectOne(`${environment.apiBaseUrl}/telegram/pairing/status`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('POSTs to unlink telegram pairing', () => {
    const response: UnlinkTelegramChatResponse = {
      chatId: 12345,
      unpairedAt: '2026-06-19T13:00:00.000Z',
    };

    service.unlink().subscribe(result => expect(result).toEqual(response));

    const req = http.expectOne(`${environment.apiBaseUrl}/telegram/pairing/unlink`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(response);
  });
});
