import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { Layout } from './layout';
import { AuthService } from '../../core/auth/auth.service';
import { PaywallService } from '../../core/servicios/paywall';

describe('Layout', () => {
  let component: Layout;
  let fixture: ComponentFixture<Layout>;
  let mockAuthService: any;
  let mockPaywallService: any;

  beforeEach(async () => {
    mockAuthService = {
      isPremium: signal(false),
      hasExpiredPremium: signal(false),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getToken: vi.fn().mockReturnValue('mock-token'),
      getNombre: vi.fn().mockReturnValue('Test User'),
      getEmail: vi.fn().mockReturnValue('test@example.com'),
      getUserId: vi.fn().mockReturnValue('user-1'),
      getHogarId: vi.fn().mockReturnValue('hogar-1'),
      getPlan: vi.fn().mockReturnValue('Básico'),
      getSubscriptionStatus: vi.fn().mockReturnValue('None'),
      getSubscriptionEndsAt: vi.fn().mockReturnValue(null),
      getTrialEndsAt: vi.fn().mockReturnValue(null),
    };

    mockPaywallService = {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: PaywallService, useValue: mockPaywallService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Layout);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not show warning banner if user is premium or not expired', () => {
    mockAuthService.isPremium.set(true);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.alert-expired');
    expect(banner).toBeNull();
  });

  it('should show warning banner if subscription has expired', () => {
    mockAuthService.isPremium.set(false);
    mockAuthService.hasExpiredPremium.set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.alert-expired');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('suscripción o período de prueba del Plan Hogar ha expirado');
  });

  it('should trigger paywall.open() when clicking "Ver Planes"', () => {
    mockAuthService.isPremium.set(false);
    mockAuthService.hasExpiredPremium.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.alert-expired button');
    expect(button).toBeTruthy();
    button.click();

    expect(mockPaywallService.open).toHaveBeenCalled();
  });
});
