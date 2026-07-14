import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { defer, finalize, Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface JwtPayload {
  usuarioId: string;
  hogarId: string;
  email: string;
  nombre: string;
  exp: number;
  plan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
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
  aceptaTerminos: boolean;
}

export interface RegisterResponse {
  usuarioId: string | null;
  hogarId: string | null;
  accessToken: string | null;
  message: string;
  isSilentSuccess: boolean;
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
export const AUTH_TOKEN_CHANGED_EVENT = 'nido-auth-token-changed';

export interface AuthTokenChangeDetail {
  previousUserId: string | null;
  userId: string | null;
}
const PREMIUM_PLAN = 'Hogar';
const MAX_TIMEOUT_DELAY = 2_147_483_647;

interface EntitlementState {
  isPremium: boolean;
  hasExpiredPremium: boolean;
}

function decodeBase64Url(value: string): string {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');

  const binaryString = atob(paddedValue);
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseExpiration(value: string | undefined): number | null {
  if (!value) return null;

  const expiration = Date.parse(value);
  return Number.isFinite(expiration) ? expiration : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = environment.apiBaseUrl;

  private readonly tokenSignal = signal<string | null>(this.getToken());
  private readonly entitlementClock = signal(Date.now());
  private entitlementTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenVersion = 0;
  private refreshRequest$: Observable<{ accessToken: string }> | null = null;

  private readonly decodedPayloadSignal = computed(() => {
    const token = this.tokenSignal();
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
  });

  private readonly entitlementState = computed<EntitlementState>(() => {
    const payload = this.decodedPayloadSignal();
    if (!payload) {
      return { isPremium: false, hasExpiredPremium: false };
    }

    const now = this.entitlementClock();
    const tokenExpiresAt = payload.exp * 1000;
    const hasActiveToken = Number.isFinite(tokenExpiresAt) && tokenExpiresAt > now;
    const configuredExpirationDates = [payload.subscriptionEndsAt, payload.trialEndsAt]
      .filter((value): value is string => Boolean(value));
    const validExpirationDates = configuredExpirationDates
      .map(parseExpiration)
      .filter((value): value is number => value !== null);
    const premiumUntil = validExpirationDates.length > 0
      ? Math.max(...validExpirationDates)
      : null;
    const hasConfiguredPremiumExpiration = configuredExpirationDates.length > 0;
    const hasActivePremiumPeriod = !hasConfiguredPremiumExpiration || (premiumUntil !== null && premiumUntil > now);

    return {
      isPremium: hasActiveToken && payload.plan === PREMIUM_PLAN && hasActivePremiumPeriod,
      hasExpiredPremium: payload.plan === PREMIUM_PLAN
        && hasConfiguredPremiumExpiration
        && (premiumUntil === null || premiumUntil <= now),
    };
  });

  readonly isPremium = computed(() => this.entitlementState().isPremium);
  readonly hasExpiredPremium = computed(() => this.entitlementState().hasExpiredPremium);

  constructor() {
    this.rescheduleEntitlementClock();
    this.destroyRef.onDestroy(() => this.clearEntitlementTimer());
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    const previousUserId = this.getUserId();
    this.tokenVersion += 1;
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
    this.entitlementClock.set(Date.now());
    this.rescheduleEntitlementClock();
    this.dispatchTokenChange(previousUserId, this.getUserId());
  }

  clearToken(): void {
    const previousUserId = this.getUserId();
    this.tokenVersion += 1;
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
    this.entitlementClock.set(Date.now());
    this.clearEntitlementTimer();
    this.dispatchTokenChange(previousUserId, null);
  }

  private dispatchTokenChange(previousUserId: string | null, userId: string | null): void {
    window.dispatchEvent(new CustomEvent<AuthTokenChangeDetail>(AUTH_TOKEN_CHANGED_EVENT, {
      detail: { previousUserId, userId },
    }));
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
    return this.decodedPayloadSignal();
  }

  private clearEntitlementTimer(): void {
    if (this.entitlementTimer !== null) {
      clearTimeout(this.entitlementTimer);
      this.entitlementTimer = null;
    }
  }

  private rescheduleEntitlementClock(): void {
    this.clearEntitlementTimer();

    const payload = this.decodePayload();
    if (!payload) return;

    const now = Date.now();
    const expirationDates = [
      payload.exp * 1000,
      parseExpiration(payload.subscriptionEndsAt),
      parseExpiration(payload.trialEndsAt),
    ].filter((value): value is number => value !== null && Number.isFinite(value) && value > now + 50);

    const nextExpiration = Math.min(...expirationDates);
    if (!Number.isFinite(nextExpiration)) return;

    this.entitlementTimer = setTimeout(() => {
      this.entitlementClock.set(Date.now());
      this.rescheduleEntitlementClock();
    }, Math.min(Math.max(nextExpiration - now, 1), MAX_TIMEOUT_DELAY));
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
  getPlan(): string | null {
    return this.decodePayload()?.plan ?? null;
  }
  getSubscriptionStatus(): string | null {
    return this.decodePayload()?.subscriptionStatus ?? null;
  }
  getTrialEndsAt(): string | null {
    return this.decodePayload()?.trialEndsAt ?? null;
  }
  getSubscriptionEndsAt(): string | null {
    return this.decodePayload()?.subscriptionEndsAt ?? null;
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    const formData = new FormData();
    formData.append('nombre', req.nombre);
    formData.append('email', req.email);
    formData.append('password', req.password);
    formData.append('sexo', req.sexo);
    formData.append('aceptaTerminos', String(req.aceptaTerminos));

    if (req.foto) {
      formData.append('foto', req.foto);
    }

    return this.http
      .post<RegisterResponse>(`${this.base}/auth/register`, formData, { withCredentials: true })
      .pipe(tap((res) => {
        if (res.accessToken) {
          this.setToken(res.accessToken);
        }
      }));
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
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const requestTokenVersion = this.tokenVersion;
    this.refreshRequest$ = defer(() => this.http
      .post<{ accessToken: string }>(`${this.base}/auth/refresh`, {}, { withCredentials: true }))
      .pipe(
        tap((res) => {
          if (this.tokenVersion === requestTokenVersion) {
            this.setToken(res.accessToken);
          }
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    return this.refreshRequest$;
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
