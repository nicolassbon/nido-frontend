import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface JwtPayload {
  usuarioId: string;
  hogarId:   string;
  email:     string;
  exp:       number;
}

export interface LoginResponse {
  usuarioId:   string;
  hogarId:     string;
  accessToken: string;
}

export interface GoogleLoginResponse {
  usuarioId:   string;
  hogarId:     string;
  accessToken: string;
  isNewUser:   boolean;
}

const TOKEN_KEY = 'accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base   = environment.apiBaseUrl;

  // ── Token storage ────────────────────────────────────────────────────────────

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
    return this.getToken() !== null;
  }



  private decodePayload(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  getUserId(): string | null  { return this.decodePayload()?.usuarioId ?? null; }
  getHogarId(): string | null { return this.decodePayload()?.hogarId   ?? null; }
  getEmail(): string | null   { return this.decodePayload()?.email      ?? null; }

  // ── API calls ────────────────────────────────────────────────────────────────

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  googleLogin(idToken: string): Observable<GoogleLoginResponse> {
    return this.http
      .post<GoogleLoginResponse>(`${this.base}/auth/google-login`, { idToken }, { withCredentials: true })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  refresh(): Observable<{ accessToken: string }> {
    return this.http
      .post<{ accessToken: string }>(`${this.base}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap(res => this.setToken(res.accessToken)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.base}/auth/logout`, {}, { withCredentials: true })
      .pipe(tap(() => {
        this.clearToken();
        this.router.navigate(['/login']);
      }));
  }
}
