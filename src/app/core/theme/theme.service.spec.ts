import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let http: HttpTestingController;
  let matchMediaMock: ReturnType<typeof vi.fn>;

  const setup = (): ThemeService => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ThemeService);
  };

  const flushThemeEffects = (): void => {
    const testBed = TestBed as unknown as { flushEffects?: () => void };
    testBed.flushEffects?.();
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');

    matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('aplica dark y lo guarda en localStorage sin requerir sesion', () => {
    const service = setup();

    service.setTheme('dark');
    flushThemeEffects();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('nido-theme-mode')).toBe('dark');
  });

  it('respeta el tema del sistema cuando el modo es system', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const service = setup();

    service.setTheme('system');
    flushThemeEffects();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sincroniza el tema desde backend cuando hay sesion', () => {
    localStorage.setItem('accessToken', 'jwt');
    const service = setup();

    service.syncFromRemote();

    const req = http.expectOne(`${environment.apiBaseUrl}/preferencias/usuario`);
    expect(req.request.method).toBe('GET');
    req.flush({ diasAlerta: 7, temaPreferido: 'dark' });
    flushThemeEffects();

    expect(service.themeMode()).toBe('dark');
    expect(localStorage.getItem('nido-theme-mode')).toBe('dark');
  });

  it('guarda el tema en backend cuando hay sesion', () => {
    localStorage.setItem('accessToken', 'jwt');
    const service = setup();

    service.setTheme('light');

    const req = http.expectOne(`${environment.apiBaseUrl}/preferencias/usuario`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ temaPreferido: 'light' });
    req.flush({ diasAlerta: 7, temaPreferido: 'light' });
  });

  it('conserva el tema local si falla el guardado remoto', () => {
    localStorage.setItem('accessToken', 'jwt');
    const service = setup();

    service.setTheme('dark');

    const req = http.expectOne(`${environment.apiBaseUrl}/preferencias/usuario`);
    req.error(new ProgressEvent('error'));
    flushThemeEffects();

    expect(service.themeMode()).toBe('dark');
    expect(localStorage.getItem('nido-theme-mode')).toBe('dark');
  });
});
