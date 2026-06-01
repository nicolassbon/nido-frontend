import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface JwtPayload {
  usuarioId: string;
  hogarId: string;
  email: string;
  nombre: string;
  exp: number;
}

export interface LoginResponse {
  usuarioId: string;
  hogarId: string;
  accessToken: string;
}

export interface GoogleLoginResponse {
  usuarioId: string;
  hogarId: string;
  accessToken: string;
  isNewUser: boolean;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  sexo: string;
  foto?: File | null;
}

export interface RegisterResponse {
  usuarioId: string;
  hogarId: string;
  accessToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export interface AddPasswordRequest {
  newPassword: string;
  newPasswordConfirmation: string;
}

const TOKEN_KEY = 'accessToken';

function decodeBase64Url(value: string): string {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');

  return atob(paddedValue);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = environment.apiBaseUrl;

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const payload = this.decodePayload();

    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      this.clearToken();
      return false;
    }

    if (payload.exp * 1000 <= Date.now()) {
      this.clearToken();
      return false;
    }

    return true;
  }

  private decodePayload(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const segments = token.split('.');
      const [header = '', payload = '', signature = ''] = segments;

      if (!header || !payload || !signature || segments.length !== 3) {
        return null;
      }

      return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
    } catch {
      return null;
    }
  }

  getUserId(): string | null {
    return this.decodePayload()?.usuarioId ?? null;
  }
  getHogarId(): string | null {
    return this.decodePayload()?.hogarId ?? null;
  }
  getEmail(): string | null {
    return this.decodePayload()?.email ?? null;
  }
  getNombre(): string | null {
    return this.decodePayload()?.nombre ?? null;
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    const formData = new FormData();
    formData.append('nombre', req.nombre);
    formData.append('email', req.email);
    formData.append('password', req.password);
    formData.append('sexo', req.sexo);

    if (req.foto) {
      formData.append('foto', req.foto);
    }

    return this.http
      .post<RegisterResponse>(`${this.base}/auth/register`, formData, { withCredentials: true })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, { email });
  }

  resetPassword(req: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, req);
  }

  changePassword(req: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/change-password`, req, { withCredentials: true });
  }

  addPassword(req: AddPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/add-password`, req, { withCredentials: true });
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.base}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.setToken(res.accessToken)));
  }

  googleLogin(idToken: string): Observable<GoogleLoginResponse> {
    return this.http
      .post<GoogleLoginResponse>(
        `${this.base}/auth/google-login`,
        { idToken },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.setToken(res.accessToken)));
  }

  refresh(): Observable<{ accessToken: string }> {
    return this.http
      .post<{ accessToken: string }>(`${this.base}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap((res) => this.setToken(res.accessToken)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearToken();
        this.router.navigate(['/login']);
      }),
    );
  }
}
