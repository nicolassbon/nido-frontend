import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { authChildGuard, authGuard } from './auth';
import { Observable, of, throwError } from 'rxjs';

describe('authGuard', () => {
  const authService = {
    isAuthenticated: vi.fn<() => boolean>(),
    refresh: vi.fn<() => Observable<{ accessToken: string }>>(),
  };

  beforeEach(() => {
    authService.isAuthenticated.mockReset();
    authService.refresh.mockReset();

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
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('allows navigation if not authenticated but refresh succeeds', () => {
    authService.isAuthenticated.mockReturnValue(false);
    authService.refresh.mockReturnValue(of({ accessToken: 'new-token' }));

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as Observable<boolean | UrlTree>;

    result.subscribe((val) => {
      expect(val).toBe(true);
    });
    expect(authService.refresh).toHaveBeenCalled();
  });

  it('redirects to /login when the user is not authenticated and refresh fails', () => {
    authService.isAuthenticated.mockReturnValue(false);
    authService.refresh.mockReturnValue(throwError(() => new Error('Refresh failed')));

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as Observable<boolean | UrlTree>;
    const router = TestBed.inject(Router);

    result.subscribe((val) => {
      expect(router.serializeUrl(val as UrlTree)).toBe('/login');
    });
    expect(authService.refresh).toHaveBeenCalled();
  });
});

describe('authChildGuard', () => {
  const authService = {
    isAuthenticated: vi.fn<() => boolean>(),
    refresh: vi.fn<() => Observable<{ accessToken: string }>>(),
  };

  beforeEach(() => {
    authService.isAuthenticated.mockReset();
    authService.refresh.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('reuses the auth guard logic for child routes', () => {
    authService.isAuthenticated.mockReturnValue(false);
    authService.refresh.mockReturnValue(throwError(() => new Error('Refresh failed')));

    const result = TestBed.runInInjectionContext(() => authChildGuard({} as never, {} as never)) as Observable<boolean | UrlTree>;
    const router = TestBed.inject(Router);

    result.subscribe((val) => {
      expect(router.serializeUrl(val as UrlTree)).toBe('/login');
    });
  });
});
