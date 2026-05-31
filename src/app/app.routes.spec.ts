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
    expect(routes.find((route) => route.path === '')?.canActivateChild).toEqual([authChildGuard]);
  });
});
