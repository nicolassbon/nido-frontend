import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const authService = {
    getToken: vi.fn<() => string | null>(),
    refresh: vi.fn().mockReturnValue(of({ accessToken: 'refreshed-token' })),
    clearToken: vi.fn(),
  };

  beforeEach(() => {
    authService.getToken.mockReset();
    authService.refresh.mockClear();
    authService.clearToken.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches bearer token to protected auth endpoints like add-password', () => {
    authService.getToken.mockReturnValue('stored-token');

    http.post(`${environment.apiBaseUrl}/auth/add-password`, {}).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/add-password`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer stored-token');
    req.flush({ message: 'ok' });
  });

  it('does not attach bearer token to public auth endpoints like login', () => {
    authService.getToken.mockReturnValue('stored-token');

    http.post(`${environment.apiBaseUrl}/auth/login`, {}).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: 'jwt', usuarioId: 'u-1', hogarId: 'h-1' });
  });
});
