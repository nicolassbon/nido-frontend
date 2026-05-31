import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { authChildGuard, authGuard } from './auth';

describe('authGuard', () => {
  const authService = {
    isAuthenticated: vi.fn<() => boolean>(),
  };

  beforeEach(() => {
    authService.isAuthenticated.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('allows navigation when the user is authenticated', () => {
    authService.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects to /login when the user is not authenticated', () => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('authChildGuard', () => {
  const authService = {
    isAuthenticated: vi.fn<() => boolean>(),
  };

  beforeEach(() => {
    authService.isAuthenticated.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('reuses the auth guard logic for child routes', () => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authChildGuard({} as never, {} as never));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
