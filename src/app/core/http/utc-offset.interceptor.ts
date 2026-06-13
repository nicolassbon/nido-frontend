import { HttpInterceptorFn } from '@angular/common/http';

export const utcOffsetInterceptor: HttpInterceptorFn = (req, next) => {
  const offset = new Date().getTimezoneOffset();
  return next(req.clone({ setParams: { utcOffsetMinutes: offset.toString() } }));
};
