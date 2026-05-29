import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Auth endpoints manejan sus propias credenciales — no tocarlos
  if (req.url.includes('/auth/')) return next(req);

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
