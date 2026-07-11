import { PRIMARY_OUTLET, type Router } from '@angular/router';

const PAYMENT_RETURN_STATUS = {
  SUCCESS: 'success',
  APPROVED: 'approved',
} as const;

const SAFE_APPROVED_PAYMENT_RETURN_URL = '/perfil?status=approved';

export function normalizePaymentReturnStatus(status: unknown): string | null {
  const statuses = Array.isArray(status) ? status : [status];
  const normalizedStatuses = statuses
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return normalizedStatuses.some(
    (value) => value === PAYMENT_RETURN_STATUS.SUCCESS || value === PAYMENT_RETURN_STATUS.APPROVED,
  )
    ? PAYMENT_RETURN_STATUS.SUCCESS
    : (normalizedStatuses[0] ?? null);
}

export function getSafeApprovedPaymentReturnUrl(router: Router, returnUrl: unknown): string | null {
  if (typeof returnUrl !== 'string' || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return null;
  }

  try {
    const urlTree = router.parseUrl(returnUrl);
    const primaryPath = urlTree.root.children[PRIMARY_OUTLET]?.segments
      .map((segment) => segment.path)
      .join('/');

    if (
      primaryPath !== 'perfil' ||
      normalizePaymentReturnStatus(urlTree.queryParamMap.getAll('status')) !==
        PAYMENT_RETURN_STATUS.SUCCESS
    ) {
      return null;
    }

    return SAFE_APPROVED_PAYMENT_RETURN_URL;
  } catch {
    return null;
  }
}
