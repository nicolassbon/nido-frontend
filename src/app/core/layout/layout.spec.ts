import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { Layout } from './layout';
import { AuthService } from '../../core/auth/auth.service';
import { PaywallService } from '../../core/servicios/paywall';
import { PostPaymentReturnService, PREMIUM_ACTIVATED_MESSAGE } from '../post-payment-return';

describe('Layout', () => {
  let component: Layout;
  let fixture: ComponentFixture<Layout>;
  let mockAuthService: any;
  let mockPaywallService: any;
  let mockPostPaymentReturn: {
    successFlash: WritableSignal<{ message: string; origin: string } | null>;
    dismissSuccessFlash: ReturnType<typeof vi.fn>;
  };

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
    mockPostPaymentReturn = {
      successFlash: signal<{ message: string; origin: string } | null>(null),
      dismissSuccessFlash: vi.fn(() => mockPostPaymentReturn.successFlash.set(null)),
    };

    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: PaywallService, useValue: mockPaywallService },
        { provide: PostPaymentReturnService, useValue: mockPostPaymentReturn },
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

  it('displays and consumes the post-payment success flash exactly once', () => {
    mockPostPaymentReturn.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/alacena' });
    component['handlePaymentFlashNavigation']('/alacena');
    fixture.detectChanges();

    const flash = fixture.nativeElement.querySelector('[role="status"]');
    expect(flash?.textContent).toContain(PREMIUM_ACTIVATED_MESSAGE);

    flash.querySelector('[aria-label="Cerrar mensaje de suscripción activa"]').click();
    fixture.detectChanges();

    expect(mockPostPaymentReturn.dismissSuccessFlash).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.alert-payment-success')).toBeNull();
  });

  it('keeps the flash on its destination and clears it after navigation away', () => {
    mockPostPaymentReturn.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/recetas?mode=ai' });

    component['handlePaymentFlashNavigation']('/recetas?mode=ai');
    expect(mockPostPaymentReturn.dismissSuccessFlash).not.toHaveBeenCalled();

    component['handlePaymentFlashNavigation']('/finanzas');
    expect(mockPostPaymentReturn.dismissSuccessFlash).toHaveBeenCalledTimes(1);
    expect(mockPostPaymentReturn.successFlash()).toBeNull();
  });

  it('does not display a destination flash before destination navigation completes', () => {
    mockPostPaymentReturn.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/alacena' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();

    component['handlePaymentFlashNavigation']('/alacena');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(PREMIUM_ACTIVATED_MESSAGE);
  });
});
