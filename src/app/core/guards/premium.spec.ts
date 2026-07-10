import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { PaywallService } from '../servicios/paywall';
import { premiumGuard } from './premium';
import { signal } from '@angular/core';

describe('premiumGuard', () => {
  const isPremiumSignal = signal(false);
  const authService = {
    isPremium: isPremiumSignal,
  };

  const paywallService = {
    open: vi.fn(),
  };

  beforeEach(() => {
    isPremiumSignal.set(false);
    paywallService.open.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: PaywallService, useValue: paywallService },
      ],
    });
  });

  it('allows navigation when user is premium', () => {
    isPremiumSignal.set(true);

    const result = TestBed.runInInjectionContext(() => premiumGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(paywallService.open).not.toHaveBeenCalled();
  });

  it('blocks navigation and opens paywall when user is not premium', () => {
    isPremiumSignal.set(false);

    const result = TestBed.runInInjectionContext(() => premiumGuard({} as never, {} as never));

    expect(result).toBe(false);
    expect(paywallService.open).toHaveBeenCalled();
  });
});
