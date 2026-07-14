import { Component, inject, signal, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize, Subscription, timeout, TimeoutError } from 'rxjs';
import { PaywallService } from '../../../core/servicios/paywall';
import { environment } from '../../../../environments/environment';
import { PostPaymentReturnService } from '../../../core/post-payment-return';

interface CheckoutResponse {
  preferenceId: string;
  initPoint: string;
}

const CHECKOUT_TIMEOUT_MS = 10_000;
const MERCADO_PAGO_CHECKOUT_HOSTS = new Set([
  'mercadopago.com',
  'www.mercadopago.com',
  'www.mercadopago.com.ar',
  'sandbox.mercadopago.com',
]);

function isTrustedCheckoutUrl(initPoint: unknown): initPoint is string {
  if (typeof initPoint !== 'string') return false;

  try {
    const url = new URL(initPoint);
    return url.protocol === 'https:'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && MERCADO_PAGO_CHECKOUT_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/checkout/');
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-paywall-modal',
  imports: [CommonModule],
  templateUrl: './paywall-modal.html',
  styleUrl: './paywall-modal.scss'
})
export class PaywallModalComponent {
  readonly paywallService = inject(PaywallService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly postPaymentReturn = inject(PostPaymentReturnService);

  readonly isOpen = this.paywallService.isOpen;
  readonly isCreatingCheckout = signal(false);
  readonly checkoutError = signal<string | null>(null);
  private checkoutSubscription: Subscription | null = null;
  private checkoutRequestId = 0;

  close(): void {
    this.cancelCheckout();
    this.checkoutError.set(null);
    this.paywallService.close();
  }

  private navigateToCheckout(url: string): void {
    window.location.assign(url);
  }

  subscribe(): void {
    if (this.isCreatingCheckout()) {
      return;
    }

    this.postPaymentReturn.clearCheckoutOrigin();
    const requestId = ++this.checkoutRequestId;
    this.checkoutError.set(null);
    this.isCreatingCheckout.set(true);

    this.checkoutSubscription = this.http
      .post<CheckoutResponse>(`${environment.apiBaseUrl}/payments/checkout`, {})
      .pipe(
        timeout(CHECKOUT_TIMEOUT_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestId === this.checkoutRequestId) {
            this.isCreatingCheckout.set(false);
            this.checkoutSubscription = null;
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.checkoutRequestId) return;

          if (!isTrustedCheckoutUrl(response.initPoint)) {
            this.checkoutError.set('No pudimos abrir el checkout de forma segura. Intentá de nuevo.');
            return;
          }

          try {
            this.postPaymentReturn.captureCheckoutOrigin(this.router.url);
            this.navigateToCheckout(response.initPoint);
          } catch {
            this.postPaymentReturn.clearCheckoutOrigin();
            this.checkoutError.set('No pudimos abrir el checkout. Intentá de nuevo.');
          }
        },
        error: (error: unknown) => {
          if (requestId !== this.checkoutRequestId) return;

          this.checkoutError.set(
            error instanceof TimeoutError
              ? 'El checkout demoró demasiado. Verificá tu conexión e intentá de nuevo.'
              : 'No pudimos iniciar el checkout. Intentá de nuevo.',
          );
        },
      });
  }

  private cancelCheckout(): void {
    this.checkoutRequestId += 1;
    this.checkoutSubscription?.unsubscribe();
    this.checkoutSubscription = null;
    this.isCreatingCheckout.set(false);
  }
}
