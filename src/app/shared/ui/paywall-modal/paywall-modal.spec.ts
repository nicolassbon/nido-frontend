import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PaywallModalComponent } from './paywall-modal';
import { PaywallService } from '../../../core/servicios/paywall';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';
import { PostPaymentReturnService } from '../../../core/post-payment-return';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';

interface CheckoutNavigationTarget {
  navigateToCheckout(url: string): void;
}

interface CheckoutStateTarget {
  checkoutError: () => string | null;
}

describe('PaywallModalComponent', () => {
  let component: PaywallModalComponent;
  let fixture: ComponentFixture<PaywallModalComponent>;
  let paywallService: PaywallService;
  let httpMock: HttpTestingController;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let mockPostPaymentReturn: { captureCheckoutOrigin: ReturnType<typeof vi.fn>; clearCheckoutOrigin: ReturnType<typeof vi.fn> };
  let mockRouter: { url: string };

  beforeEach(() => {
    mockPostPaymentReturn = {
      captureCheckoutOrigin: vi.fn(),
      clearCheckoutOrigin: vi.fn(),
    };
    mockRouter = { url: '/alacena?tab=stock#item-1' };

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        PaywallModalComponent,
      ],
      providers: [
        PaywallService,
        { provide: Router, useValue: mockRouter },
        { provide: PostPaymentReturnService, useValue: mockPostPaymentReturn },
      ],
    });

    fixture = TestBed.createComponent(PaywallModalComponent);
    component = fixture.componentInstance;
    navigateSpy = vi.spyOn(
      component as unknown as CheckoutNavigationTarget,
      'navigateToCheckout',
    ).mockImplementation(() => undefined);
    paywallService = TestBed.inject(PaywallService);
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
  });

  afterEach(() => {
    navigateSpy?.mockRestore?.();
    httpMock.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  it('should not show modal when isOpen is false', () => {
    paywallService.isOpen.set(false);
    fixture.detectChanges();
    const modalElement = fixture.nativeElement.querySelector('.paywall-overlay');
    expect(modalElement).toBeNull();
  });

  it('should show modal and render benefits when isOpen is true', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    const modalElement = fixture.nativeElement.querySelector('.paywall-overlay');
    expect(modalElement).toBeTruthy();

    const contentText = fixture.nativeElement.textContent;
    expect(contentText).toContain('Hogar');
    expect(contentText).toContain('Escaneo inteligente de tickets');
    expect(contentText).toContain('Planificador nutricional inteligente');
  });

  it('should close when clicking the close button', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.paywall-close');
    expect(closeBtn).toBeTruthy();
    closeBtn.click();

    expect(paywallService.isOpen()).toBe(false);
  });

  it('redirects only to an official Mercado Pago production checkout URL', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    const subscribeBtn = fixture.nativeElement.querySelector('.btn-subscribe');
    expect(subscribeBtn).toBeTruthy();
    subscribeBtn.click();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`);
    expect(req.request.method).toBe('POST');
    req.flush({ preferenceId: 'pref-123', initPoint: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-123' });

    expect(navigateSpy).toHaveBeenCalledWith('https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-123');
  });

  it('stores the current internal router URL immediately before trusted checkout navigation', () => {
    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'pref-123',
      initPoint: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-123',
    });

    expect(mockPostPaymentReturn.captureCheckoutOrigin).toHaveBeenCalledWith('/alacena?tab=stock#item-1');
    expect(mockPostPaymentReturn.captureCheckoutOrigin.mock.invocationCallOrder[0])
      .toBeLessThan(navigateSpy.mock.invocationCallOrder[0]);
  });

  it('clears stale checkout context before a failed checkout request', () => {
    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
    expect(mockPostPaymentReturn.captureCheckoutOrigin).not.toHaveBeenCalled();
  });

  it('accepts an official Mercado Pago Sandbox checkout URL', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'sandbox-pref-123',
      initPoint: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=sandbox-pref-123',
    });

    expect(navigateSpy).toHaveBeenCalledWith(
      'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=sandbox-pref-123',
    );
  });

  it('rejects an invalid or untrusted checkout URL without redirecting', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'pref-123',
      initPoint: 'https://checkout.example.test/checkout/v1/redirect?pref_id=pref-123',
    });

    const state = component as unknown as CheckoutStateTarget;
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(state.checkoutError()).toContain('No pudimos abrir el checkout');
  });

  it('cancels a pending checkout request when the modal is closed', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    const request = httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`);
    component.close();

    expect(request.cancelled).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(paywallService.isOpen()).toBe(false);
  });

  it('shows a retryable error and resets loading when checkout times out', () => {
    vi.useFakeTimers();
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    const request = httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`);
    vi.advanceTimersByTime(10_000);

    const state = component as unknown as CheckoutStateTarget & { isCreatingCheckout: () => boolean };
    expect(request.cancelled).toBe(true);
    expect(state.isCreatingCheckout()).toBe(false);
    expect(state.checkoutError()).toContain('demoró demasiado');
  });

  it('shows a retryable error and resets loading when checkout fails', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush(
      { message: 'sensitive gateway response' },
      { status: 500, statusText: 'Server Error' },
    );

    const state = component as unknown as CheckoutStateTarget & { isCreatingCheckout: () => boolean };
    expect(state.isCreatingCheckout()).toBe(false);
    expect(state.checkoutError()).toContain('No pudimos iniciar el checkout');
  });

  it('shows a retryable error when browser navigation fails synchronously', () => {
    navigateSpy.mockImplementationOnce(() => {
      throw new Error('navigation unavailable');
    });
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'pref-123',
      initPoint: 'https://mercadopago.com/checkout/v1/redirect?pref_id=pref-123',
    });

    const state = component as unknown as CheckoutStateTarget & { isCreatingCheckout: () => boolean };
    expect(state.isCreatingCheckout()).toBe(false);
    expect(state.checkoutError()).toContain('No pudimos abrir el checkout');
  });

  it('clears the previous checkout error when the user retries', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    component.subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'pref-123',
      initPoint: 'not a URL',
    });

    const state = component as unknown as CheckoutStateTarget;
    expect(state.checkoutError()).not.toBeNull();

    component.subscribe();
    expect(state.checkoutError()).toBeNull();
    httpMock.expectOne(`${environment.apiBaseUrl}/payments/checkout`).flush({
      preferenceId: 'pref-456',
      initPoint: 'https://mercadopago.com/checkout/v1/redirect?pref_id=pref-456',
    });

    expect(navigateSpy).toHaveBeenCalledWith('https://mercadopago.com/checkout/v1/redirect?pref_id=pref-456');
  });

  it('should ignore repeated subscribe clicks while checkout is pending', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    const subscribeBtn = fixture.nativeElement.querySelector('.btn-subscribe');
    expect(subscribeBtn).toBeTruthy();

    subscribeBtn.click();
    subscribeBtn.click();

    const requests = httpMock.match(`${environment.apiBaseUrl}/payments/checkout`);
    expect(requests.length).toBe(1);

    requests[0].flush({ preferenceId: 'pref-123', initPoint: 'https://mercadopago.com/checkout/123' });
    expect(navigateSpy).toHaveBeenCalledTimes(1);
  });

  it('should still create checkout request when navigation is stubbed', () => {
    paywallService.isOpen.set(true);
    fixture.detectChanges();

    const subscribeBtn = fixture.nativeElement.querySelector('.btn-subscribe');
    subscribeBtn.click();

    const requests = httpMock.match(`${environment.apiBaseUrl}/payments/checkout`);
    expect(requests.length).toBe(1);
  });
});
