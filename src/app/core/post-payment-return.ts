import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { PRIMARY_OUTLET, Router } from '@angular/router';
import { AuthService, AUTH_TOKEN_CHANGED_EVENT, type AuthTokenChangeDetail } from './auth/auth.service';
import { normalizePaymentReturnStatus } from './payment-return';

export const PREMIUM_ACTIVATED_MESSAGE = 'Tu suscripción ya está activa. Ya podés disfrutar de todas las funciones del Plan Hogar.';

const CHECKOUT_ORIGIN_STORAGE_KEY = 'nido:checkout-origin';
const PAYMENT_CALLBACK_PATH = 'perfil';
const CHECKOUT_CONTEXT_TTL_MS = 30 * 60_000;

interface CheckoutContext {
  origin: string;
  expiresAt: number;
  userId: string;
}

interface PaymentSuccessFlash {
  message: string;
  origin: string;
}

@Injectable({ providedIn: 'root' })
export class PostPaymentReturnService {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly successFlash = signal<PaymentSuccessFlash | null>(null);

  constructor() {
    const clearForSessionChange = (event: Event) => {
      const detail = (event as CustomEvent<AuthTokenChangeDetail>).detail;
      if (!detail || detail.userId === null || detail.userId !== detail.previousUserId) {
        this.clearPostPaymentState();
      }
    };

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, clearForSessionChange);
    this.destroyRef.onDestroy(() => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, clearForSessionChange));
  }

  captureCheckoutOrigin(routerUrl: string): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    const context: CheckoutContext = {
      origin: routerUrl,
      expiresAt: Date.now() + CHECKOUT_CONTEXT_TTL_MS,
      userId,
    };

    try {
      sessionStorage.setItem(CHECKOUT_ORIGIN_STORAGE_KEY, JSON.stringify(context));
    } catch {
      // Storage can be unavailable in private browsing; checkout still proceeds safely.
    }
  }

  clearCheckoutOrigin(): void {
    try {
      sessionStorage.removeItem(CHECKOUT_ORIGIN_STORAGE_KEY);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }

  clearPostPaymentState(): void {
    this.clearCheckoutOrigin();
    this.dismissSuccessFlash();
  }

  async redirectAfterConfirmedPayment(): Promise<boolean> {
    const origin = this.consumeSafeCheckoutOrigin();
    if (!origin || this.isPerfilUrl(origin)) return false;

    this.dismissSuccessFlash();
    try {
      const navigated = await this.router.navigateByUrl(origin);
      if (!navigated || this.router.url !== origin) {
        this.dismissSuccessFlash();
        return false;
      }

      this.successFlash.set({ message: PREMIUM_ACTIVATED_MESSAGE, origin });
      return true;
    } catch {
      this.dismissSuccessFlash();
      return false;
    }
  }

  dismissSuccessFlash(): void {
    this.successFlash.set(null);
  }

  private consumeSafeCheckoutOrigin(): string | null {
    let serializedContext: string | null = null;

    try {
      serializedContext = sessionStorage.getItem(CHECKOUT_ORIGIN_STORAGE_KEY);
      sessionStorage.removeItem(CHECKOUT_ORIGIN_STORAGE_KEY);
    } catch {
      return null;
    }

    const context = this.parseCheckoutContext(serializedContext);
    const now = Date.now();
    if (
      !context
      || context.expiresAt < now
      || context.expiresAt > now + CHECKOUT_CONTEXT_TTL_MS
      || context.userId !== this.authService.getUserId()
    ) {
      return null;
    }

    return this.getSafeInternalUrl(context.origin);
  }

  private parseCheckoutContext(value: string | null): CheckoutContext | null {
    if (!value) return null;

    try {
      const parsed: unknown = JSON.parse(value);
      if (
        typeof parsed !== 'object'
        || parsed === null
        || !('origin' in parsed)
        || !('expiresAt' in parsed)
        || !('userId' in parsed)
        || typeof parsed.origin !== 'string'
        || typeof parsed.expiresAt !== 'number'
        || !Number.isFinite(parsed.expiresAt)
        || typeof parsed.userId !== 'string'
      ) {
        return null;
      }

      return {
        origin: parsed.origin,
        expiresAt: parsed.expiresAt,
        userId: parsed.userId,
      };
    } catch {
      return null;
    }
  }

  private getSafeInternalUrl(origin: string | null): string | null {
    if (typeof origin !== 'string' || !origin.startsWith('/') || origin.startsWith('//')) {
      return null;
    }

    let decodedOrigin: string;
    try {
      decodedOrigin = decodeURIComponent(origin);
    } catch {
      return null;
    }

    if (
      decodedOrigin.startsWith('//')
      || decodedOrigin.includes('\\')
      || /^\/[a-z][a-z\d+.-]*:/i.test(decodedOrigin)
    ) {
      return null;
    }

    try {
      const urlTree = this.router.parseUrl(origin);
      const primaryPath = urlTree.root.children[PRIMARY_OUTLET]?.segments
        .map((segment) => segment.path)
        .join('/');
      const isPaymentCallback = primaryPath === PAYMENT_CALLBACK_PATH
        && normalizePaymentReturnStatus(urlTree.queryParamMap.getAll('status')) === 'success';

      if (isPaymentCallback) return null;
      return origin;
    } catch {
      return null;
    }
  }

  private isPerfilUrl(url: string): boolean {
    const urlTree = this.router.parseUrl(url);
    const primaryPath = urlTree.root.children[PRIMARY_OUTLET]?.segments
      .map((segment) => segment.path)
      .join('/');

    return primaryPath === PAYMENT_CALLBACK_PATH;
  }
}
