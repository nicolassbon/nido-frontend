import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PaywallService } from '../servicios/paywall';

export const premiumGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const paywall = inject(PaywallService);

  if (auth.isPremium()) {
    return true;
  }

  paywall.open();
  return false;
};
