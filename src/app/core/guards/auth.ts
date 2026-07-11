import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { catchError, map, of } from 'rxjs';
import { getSafeApprovedPaymentReturnUrl } from '../payment-return';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return auth.refresh().pipe(
    map(() => true),
    catchError(() => {
      const paymentReturnUrl = getSafeApprovedPaymentReturnUrl(router, state.url);
      const queryParams = paymentReturnUrl
        ? { returnUrl: paymentReturnUrl }
        : undefined;

      return of(router.createUrlTree(['/login'], { queryParams }));
    }),
  );
};

export const authChildGuard: CanActivateChildFn = (childRoute, state) => authGuard(childRoute, state);

/** Redirige a /inicio si el usuario ya está autenticado (para la landing) */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/inicio']);
  }

  return auth.refresh().pipe(
    map(() => router.createUrlTree(['/inicio'])),
    catchError(() => of(true))
  );
};
