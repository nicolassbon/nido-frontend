import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { authChildGuard, authGuard } from './core/guards/auth';

describe('app routes', () => {
  it('keeps login and register public', () => {
    expect(routes.find((route) => route.path === 'login')?.canActivate).toBeUndefined();
    expect(routes.find((route) => route.path === 'registro')?.canActivate).toBeUndefined();
  });

  it('protects onboarding routes that depend on authenticated user context', () => {
    expect(routes.find((route) => route.path === 'crear-hogar')?.canActivate).toEqual([authGuard]);
    expect(routes.find((route) => route.path === 'finalizar-hogar')?.canActivate).toEqual([authGuard]);
  });

  it('protects layout children with the child auth guard', () => {
    expect(routes.find((route) => route.path === '' && route.children !== undefined)?.canActivateChild).toEqual([authChildGuard]);
  });

  it('renders configuracion inside the authenticated layout shell', () => {
    const layoutRoute = routes.find((route) => route.path === '' && route.children !== undefined);
    expect(layoutRoute?.children?.some((route) => route.path === 'configuracion')).toBe(true);
    expect(routes.find((route) => route.path === 'configuracion')).toBeUndefined();
  });

  it('declares nutrition scan before the generic product detail route', () => {
    const layoutRoute = routes.find((route) => route.path === '' && route.children !== undefined);
    const children = layoutRoute?.children ?? [];
    const nutritionIndex = children.findIndex((route) => route.path === 'alacena/:id/informacion-nutricional');
    const detailIndex = children.findIndex((route) => route.path === 'alacena/:id');

    expect(nutritionIndex).toBeGreaterThanOrEqual(0);
    expect(detailIndex).toBeGreaterThanOrEqual(0);
    expect(nutritionIndex).toBeLessThan(detailIndex);
  });
});
