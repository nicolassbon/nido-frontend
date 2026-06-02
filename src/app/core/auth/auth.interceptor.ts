import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const publicAuthPaths = [
  '/auth/register',
  '/auth/login',
  '/auth/google-login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
];

function isPublicAuthRequest(url: string): boolean {
  return publicAuthPaths.some(path => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Solo los endpoints públicos de auth deben viajar sin bearer.
  if (isPublicAuthRequest(req.url)) return next(req);

  const token = auth.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) return throwError(() => error);

      // Intentar renovar el token con el refresh cookie
      return auth.refresh().pipe(
        switchMap(res =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } })),
        ),
        catchError(refreshError => {
          // Refresh expirado — limpiar sesión
          auth.clearToken();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
