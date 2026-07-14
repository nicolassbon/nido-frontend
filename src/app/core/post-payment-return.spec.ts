import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { AuthService, AUTH_TOKEN_CHANGED_EVENT } from './auth/auth.service';
import { PostPaymentReturnService, PREMIUM_ACTIVATED_MESSAGE } from './post-payment-return';

describe('PostPaymentReturnService', () => {
  let service: PostPaymentReturnService;
  let router: Router;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let auth: { getUserId: ReturnType<typeof vi.fn> };
  let currentUrl: string;

  beforeEach(() => {
    sessionStorage.clear();
    auth = { getUserId: vi.fn().mockReturnValue('user-1') };

    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        PostPaymentReturnService,
        { provide: AuthService, useValue: auth },
      ],
    });
    router = TestBed.inject(Router);
    currentUrl = '/perfil?status=approved';
    vi.spyOn(router, 'url', 'get').mockImplementation(() => currentUrl);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockImplementation(async (url) => {
      currentUrl = typeof url === 'string' ? url : router.serializeUrl(url);
      return true;
    });
    service = TestBed.inject(PostPaymentReturnService);
  });

  it('publishes a destination flash only after successful navigation reaches the safe non-Perfil origin', async () => {
    service.captureCheckoutOrigin('/alacena?tab=stock#product-42');

    const redirected = service.redirectAfterConfirmedPayment();
    expect(navigateByUrl).toHaveBeenCalledWith('/alacena?tab=stock#product-42');
    expect(service.successFlash()).toBeNull();
    await expect(redirected).resolves.toBe(true);
    expect(service.successFlash()).toEqual({
      message: PREMIUM_ACTIVATED_MESSAGE,
      origin: '/alacena?tab=stock#product-42',
    });
    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
  });

  it('keeps Perfil on its existing success notice path', async () => {
    service.captureCheckoutOrigin('/perfil');

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(service.successFlash()).toBeNull();
  });

  it('replaces a prior checkout context when a new checkout starts', async () => {
    service.captureCheckoutOrigin('/alacena');
    service.captureCheckoutOrigin('/recetas?mode=ai');

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/recetas?mode=ai');
    expect(service.successFlash()?.origin).toBe('/recetas?mode=ai');
  });

  it('does not publish a flash when navigation resolves false', async () => {
    navigateByUrl.mockResolvedValue(false);
    service.captureCheckoutOrigin('/finanzas');

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);

    expect(service.successFlash()).toBeNull();
  });

  it('does not publish a flash or leak a rejection when navigation rejects', async () => {
    navigateByUrl.mockRejectedValue(new Error('Navigation error'));
    service.captureCheckoutOrigin('/finanzas');

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);

    expect(service.successFlash()).toBeNull();
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    '/https://evil.example',
    '/perfil?status=approved',
    '/%5Cevil.example',
  ])('rejects a tampered origin without redirecting or publishing success: %s', async (origin) => {
    sessionStorage.setItem('nido:checkout-origin', JSON.stringify({
      origin,
      expiresAt: Date.now() + 1_000,
      userId: 'user-1',
    }));

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(service.successFlash()).toBeNull();
    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
  });

  it('rejects an expired checkout context', async () => {
    sessionStorage.setItem('nido:checkout-origin', JSON.stringify({
      origin: '/recetas?mode=ai',
      expiresAt: Date.now() - 1,
      userId: 'user-1',
    }));

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('rejects a far-future checkout context and clears its storage', async () => {
    sessionStorage.setItem('nido:checkout-origin', JSON.stringify({
      origin: '/finanzas',
      expiresAt: Number.MAX_SAFE_INTEGER,
      userId: 'user-1',
    }));

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
  });

  it('rejects a checkout context created by a different authenticated user', async () => {
    sessionStorage.setItem('nido:checkout-origin', JSON.stringify({
      origin: '/finanzas',
      expiresAt: Date.now() + 1_000,
      userId: 'user-2',
    }));

    await expect(service.redirectAfterConfirmedPayment()).resolves.toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('clears checkout and flash state when auth logout or identity change occurs', () => {
    service.captureCheckoutOrigin('/lista-compras');
    service.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/lista-compras' });

    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { previousUserId: 'user-1', userId: null },
    }));

    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
    expect(service.successFlash()).toBeNull();

    service.captureCheckoutOrigin('/finanzas');
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { previousUserId: 'user-1', userId: 'user-2' },
    }));

    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
  });
});

describe('AuthService post-payment cleanup contract', () => {
  let authService: AuthService;
  let postPaymentReturn: PostPaymentReturnService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule.withRoutes([])],
      providers: [AuthService, PostPaymentReturnService],
    });
    postPaymentReturn = TestBed.inject(PostPaymentReturnService);
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('clears checkout and flash state when the authenticated identity changes through setToken', () => {
    authService.setToken(createToken('user-1'));
    postPaymentReturn.captureCheckoutOrigin('/alacena');
    postPaymentReturn.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/alacena' });

    authService.setToken(createToken('user-2'));

    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
    expect(postPaymentReturn.successFlash()).toBeNull();
  });

  it('clears checkout and flash state through the real logout path', () => {
    authService.setToken(createToken('user-1'));
    postPaymentReturn.captureCheckoutOrigin('/recetas');
    postPaymentReturn.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin: '/recetas' });

    authService.logout().subscribe();
    httpMock.expectOne(request => request.url.endsWith('/auth/logout')).flush(null);

    expect(sessionStorage.getItem('nido:checkout-origin')).toBeNull();
    expect(postPaymentReturn.successFlash()).toBeNull();
  });
});

function createToken(userId: string): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'none' })}.${encode({ usuarioId: userId, exp: Math.floor(Date.now() / 1_000) + 3_600, plan: 'Free' })}.signature`;
}
