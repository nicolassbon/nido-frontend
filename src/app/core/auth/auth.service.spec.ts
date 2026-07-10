import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, RegisterRequest, RegisterResponse } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const toBase64Url = (value: string): string => {
    const bytes = new TextEncoder().encode(value);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

  const createToken = (payload: Record<string, unknown>): string => {
    const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = toBase64Url(JSON.stringify(payload));
    return `${header}.${body}.signature`;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('register', () => {
    it('should send a FormData POST request when no photo is provided and store the access token on success', () => {
      const mockRequest: RegisterRequest = {
        nombre: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        sexo: 'Masculino',
        foto: null,
        aceptaTerminos: true,
      };

      const mockResponse: RegisterResponse = {
        usuarioId: 'user-123',
        hogarId: 'hogar-123',
        accessToken: 'mock-jwt-token',
        message: 'Registration completed.',
        isSilentSuccess: false,
      };

      service.register(mockRequest).subscribe((res) => {
        expect(res).toEqual(mockResponse);
        expect(service.getToken()).toBe('mock-jwt-token');
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);

      const body = req.request.body as FormData;
      expect(body.get('nombre')).toBe('Test User');
      expect(body.get('email')).toBe('test@example.com');
      expect(body.get('password')).toBe('Password123!');
      expect(body.get('sexo')).toBe('Masculino');
      expect(body.get('foto')).toBeNull();
      expect(body.get('aceptaTerminos')).toBe('true');
      expect(req.request.withCredentials).toBe(true);

      req.flush(mockResponse);
    });

    it('should append the selected photo when provided', () => {
      const foto = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });

      service.register({
        nombre: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        sexo: 'Masculino',
        foto,
        aceptaTerminos: true,
      }).subscribe();

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/register`);
      expect(req.request.body).toBeInstanceOf(FormData);
      expect(req.request.body.get('foto')).toBe(foto);
      expect((req.request.body.get('foto') as File).name).toBe('avatar.webp');
      req.flush({ usuarioId: 'user-123', hogarId: 'hogar-123', accessToken: 'mock-jwt-token', message: 'Registration completed.', isSilentSuccess: false });
    });

    it('should not store a token when register returns silent success', () => {
      const mockRequest: RegisterRequest = {
        nombre: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        sexo: 'Masculino',
        foto: null,
        aceptaTerminos: true,
      };

      service.register(mockRequest).subscribe((res) => {
        expect(res.isSilentSuccess).toBe(true);
        expect(service.getToken()).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/register`);
      req.flush({ usuarioId: null, hogarId: null, accessToken: null, message: 'Generic response.', isSilentSuccess: true });
    });
  });

  describe('password management', () => {
    it('forgotPassword should send a POST request with email to /auth/forgot-password', () => {
      const email = 'test@example.com';
      const expectedResponse = { message: 'If an account exists for that email, you will receive instructions.' };

      service.forgotPassword(email).subscribe((res) => {
        expect(res).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email });
      req.flush(expectedResponse);
    });

    it('resetPassword should send a POST request with token and passwords to /auth/reset-password', () => {
      const resetReq = {
        token: 'valid-token',
        newPassword: 'Password123!',
        newPasswordConfirmation: 'Password123!',
      };
      const expectedResponse = { message: 'Password reset successful.' };

      service.resetPassword(resetReq).subscribe((res) => {
        expect(res).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(resetReq);
      req.flush(expectedResponse);
    });

    it('changePassword should send a POST request with credentials to /auth/change-password', () => {
      const changeReq = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirmation: 'NewPassword123!',
      };
      const expectedResponse = { message: 'Password updated.' };

      service.changePassword(changeReq).subscribe((res) => {
        expect(res).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/change-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(changeReq);
      expect(req.request.withCredentials).toBe(true);
      req.flush(expectedResponse);
    });

    it('addPassword should send a POST request to /auth/add-password', () => {
      const addReq = {
        newPassword: 'Password123!',
        newPasswordConfirmation: 'Password123!',
      };
      const expectedResponse = { message: 'Password added.' };

      service.addPassword(addReq).subscribe((res) => {
        expect(res).toEqual(expectedResponse);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/add-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(addReq);
      expect(req.request.withCredentials).toBe(true);
      req.flush(expectedResponse);
    });
  });

  describe('isAuthenticated', () => {
    it('returns true for a token with a future expiration date', () => {
      service.setToken(createToken({ exp: Math.floor(Date.now() / 1000) + 60 }));

      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns false and clears the token when it is expired', () => {
      service.setToken(createToken({ exp: Math.floor(Date.now() / 1000) - 60 }));

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
    });

    it('returns false and clears the token when it cannot decode the payload', () => {
      service.setToken('not-a-jwt');

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
    });

    it('returns false and clears the token when the JWT structure is incomplete', () => {
      const payload = toBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }));
      service.setToken(`header.${payload}`);

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
    });

    it('returns false and clears the token when the decoded payload has no numeric expiration', () => {
      service.setToken(createToken({ usuarioId: 'u-1' }));

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
    });

    it('accepts a valid JWT payload encoded with base64url', () => {
      service.setToken(createToken({ exp: Math.floor(Date.now() / 1000) + 60, email: 'nico-test_01@example.com' }));

      expect(service.isAuthenticated()).toBe(true);
    });

    it('correctly decodes a UTF-8 payload with accents/tildes', () => {
      service.setToken(createToken({ exp: Math.floor(Date.now() / 1000) + 60, nombre: 'Nicolás Bon' }));

      expect(service.getNombre()).toBe('Nicolás Bon');
    });

    describe('subscription state and premium checks', () => {
      it('should parse plan, subscriptionStatus, trialEndsAt, and subscriptionEndsAt from JWT payload', () => {
        const payload = {
          exp: Math.floor(Date.now() / 1000) + 60,
          plan: 'Hogar',
          subscriptionStatus: 'active',
          trialEndsAt: '2026-07-20T23:59:59.000Z',
          subscriptionEndsAt: '2026-08-01T23:59:59.000Z',
        };
        service.setToken(createToken(payload));

        expect(service.getPlan()).toBe('Hogar');
        expect(service.getSubscriptionStatus()).toBe('active');
        expect(service.getTrialEndsAt()).toBe('2026-07-20T23:59:59.000Z');
        expect(service.getSubscriptionEndsAt()).toBe('2026-08-01T23:59:59.000Z');
      });

      it('should return null for subscription fields when not present in payload', () => {
        service.setToken(createToken({ exp: Math.floor(Date.now() / 1000) + 60 }));

        expect(service.getPlan()).toBeNull();
        expect(service.getSubscriptionStatus()).toBeNull();
        expect(service.getTrialEndsAt()).toBeNull();
        expect(service.getSubscriptionEndsAt()).toBeNull();
      });

      it('should compute isPremium as true when plan is Hogar and subscription is active in future', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
        service.setToken(createToken({
          exp: Math.floor(Date.now() / 1000) + 60,
          plan: 'Hogar',
          subscriptionEndsAt: futureDate,
        }));

        expect(service.isPremium()).toBe(true);
      });

      it('should compute isPremium as true when plan is Hogar and trial is active in future', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
        service.setToken(createToken({
          exp: Math.floor(Date.now() / 1000) + 60,
          plan: 'Hogar',
          trialEndsAt: futureDate,
        }));

        expect(service.isPremium()).toBe(true);
      });

      it('should compute isPremium as false when plan is Basico', () => {
        service.setToken(createToken({
          exp: Math.floor(Date.now() / 1000) + 60,
          plan: 'Básico',
        }));

        expect(service.isPremium()).toBe(false);
      });

      it('should compute isPremium as false when both subscription and trial have expired', () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day
        service.setToken(createToken({
          exp: Math.floor(Date.now() / 1000) + 60,
          plan: 'Hogar',
          subscriptionEndsAt: pastDate,
          trialEndsAt: pastDate,
        }));

        expect(service.isPremium()).toBe(false);
      });

      it('should compute isPremium as false when user is not authenticated', () => {
        service.clearToken();
        expect(service.isPremium()).toBe(false);
      });

      it('reactively expires premium access and exposes the centralized expired state', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));

        const expiresAt = new Date(Date.now() + 5_000).toISOString();
        service.setToken(createToken({
          exp: Math.floor((Date.now() + 60_000) / 1000),
          plan: 'Hogar',
          subscriptionEndsAt: expiresAt,
        }));

        const authWithEntitlements = service as unknown as {
          hasExpiredPremium: () => boolean;
        };

        expect(service.isPremium()).toBe(true);
        expect(authWithEntitlements.hasExpiredPremium()).toBe(false);

        vi.advanceTimersByTime(5_000);

        expect(service.isPremium()).toBe(false);
        expect(authWithEntitlements.hasExpiredPremium()).toBe(true);
        vi.useRealTimers();
      });
    });
  });

  describe('refresh serialization', () => {
    it('keeps a newer premium token when a delayed refresh returns an older entitlement', () => {
      const oldFreeToken = createToken({
        exp: Math.floor(Date.now() / 1000) + 60,
        plan: 'Básico',
      });
      const newerPremiumToken = createToken({
        exp: Math.floor(Date.now() / 1000) + 60,
        plan: 'Hogar',
        subscriptionEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      service.refresh().subscribe();
      const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);

      service.setToken(newerPremiumToken);
      request.flush({ accessToken: oldFreeToken });

      expect(service.getToken()).toBe(newerPremiumToken);
      expect(service.isPremium()).toBe(true);
    });

    it('shares concurrent refresh callers instead of creating competing requests', () => {
      service.refresh().subscribe();
      service.refresh().subscribe();

      const requests = httpMock.match(`${environment.apiBaseUrl}/auth/refresh`);
      expect(requests).toHaveLength(1);

      requests[0].flush({ accessToken: createToken({ exp: Math.floor(Date.now() / 1000) + 60 }) });
    });
  });
});
