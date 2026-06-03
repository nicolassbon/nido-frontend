import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
} from 'lucide-angular';
import { Login } from './login';
import { AuthService, type GoogleLoginResponse } from '../../../core/auth/auth.service';
import { GoogleIdentityService } from '../../../core/auth/google-identity.service';

class MockAuthService {
  login = vi.fn();
  googleLogin = vi.fn();
}

class MockGoogleIdentityService {
  private credentialHandler: ((idToken: string) => void) | null = null;
  host: HTMLElement | null = null;

  renderButton = vi.fn(async (host: HTMLElement, onCredential: (idToken: string) => void) => {
    this.host = host;
    this.credentialHandler = onCredential;
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    host.appendChild(button);
  });
  prompt = vi.fn();

  emitCredential(idToken: string): void {
    this.credentialHandler?.(idToken);
  }
}

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let mockAuthService: MockAuthService;
  let mockGoogleIdentityService: MockGoogleIdentityService;
  let router: Router;

  beforeEach(async () => {
    mockAuthService = new MockAuthService();
    mockGoogleIdentityService = new MockGoogleIdentityService();

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: GoogleIdentityService, useValue: mockGoogleIdentityService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Eye, EyeOff, Mail, Lock, ArrowRight }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create successfully', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the Google button on render', () => {
    expect(mockGoogleIdentityService.renderButton).toHaveBeenCalledTimes(1);
    expect(component.googleLoginReady()).toBe(true);
  });

  it('should initialize with an invalid form', () => {
    expect(component.form.valid).toBe(false);
    expect(component.submitted()).toBe(false);
  });

  it('should validate email format', () => {
    const emailControl = component.form.controls.email;
    emailControl.setValue('invalid-email');
    expect(emailControl.valid).toBe(false);
    expect(emailControl.errors?.['email']).toBeTruthy();

    emailControl.setValue('test@example.com');
    expect(emailControl.valid).toBe(true);
  });

  it('should validate password required', () => {
    const passwordControl = component.form.controls.password;
    expect(passwordControl.valid).toBe(false);
    expect(passwordControl.errors?.['required']).toBeTruthy();

    passwordControl.setValue('mypassword');
    expect(passwordControl.valid).toBe(true);
  });

  it('should toggle password visibility signal', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePassword();
    expect(component.showPassword()).toBe(true);
    component.togglePassword();
    expect(component.showPassword()).toBe(false);
  });

  it('should handle successful login flow', () => {
    const mockResponse = {
      usuarioId: 'u-1',
      hogarId: 'h-1',
      accessToken: 'token-jwt',
    };
    mockAuthService.login.mockReturnValue(of(mockResponse));

    component.form.patchValue({
      email: 'test@example.com',
      password: 'mypassword',
    });

    component.onSubmit();

    expect(component.submitted()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'mypassword');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should handle login unauthorized error (401/403)', () => {
    const mockError = { status: 401, message: 'Unauthorized' };
    mockAuthService.login.mockReturnValue(throwError(() => mockError));

    component.form.patchValue({
      email: 'test@example.com',
      password: 'mypassword',
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Correo o contraseña incorrectos.');
    expect(component.loading()).toBe(false);
  });

  it('should handle generic login error', () => {
    const mockError = { status: 500, message: 'Internal Server Error' };
    mockAuthService.login.mockReturnValue(throwError(() => mockError));

    component.form.patchValue({
      email: 'test@example.com',
      password: 'mypassword',
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Ocurrió un error. Intentá de nuevo.');
    expect(component.loading()).toBe(false);
  });

  it('should prompt the Google flow when the visible button is activated', () => {
    const renderedButton = mockGoogleIdentityService.host?.querySelector('div[role="button"]') as HTMLElement;
    const clickSpy = vi.spyOn(renderedButton, 'click');

    component.onGoogleLogin();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('should exchange the Google credential with the backend and redirect to home for existing users', () => {
    const mockResponse: GoogleLoginResponse = {
      usuarioId: 'u-google',
      hogarId: 'h-google',
      accessToken: 'google-token-jwt',
      isNewUser: false,
    };
    mockAuthService.googleLogin.mockReturnValue(of(mockResponse));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(component.loading()).toBe(false);
    expect(mockAuthService.googleLogin).toHaveBeenCalledWith('real-google-id-token');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect new Google users to the onboarding step 2 (/crear-hogar)', () => {
    const mockResponse: GoogleLoginResponse = {
      usuarioId: 'u-google-new',
      hogarId: 'h-google-new',
      accessToken: 'google-token-jwt-new',
      isNewUser: true,
    };
    mockAuthService.googleLogin.mockReturnValue(of(mockResponse));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(component.loading()).toBe(false);
    expect(mockAuthService.googleLogin).toHaveBeenCalledWith('real-google-id-token');
    expect(router.navigate).toHaveBeenCalledWith(['/crear-hogar']);
  });

  it('should handle Google login failure and set the global error signal', () => {
    const mockError = { status: 400, message: 'Bad Request' };
    mockAuthService.googleLogin.mockReturnValue(throwError(() => mockError));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(component.globalError()).toBe('Error al iniciar sesión con Google.');
    expect(component.loading()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should show a helpful message when Google login is not ready', () => {
    component.googleLoginReady.set(false);

    component.onGoogleLogin();

    expect(component.globalError()).toBe(
      'Google Login no está disponible todavía. Revisá la configuración del cliente.',
    );
  });

  it('should show an origin/config error when the rendered Google button is unavailable', async () => {
    const host = mockGoogleIdentityService.host as HTMLElement;
    host.innerHTML = '';
    component.googleLoginReady.set(true);

    component.onGoogleLogin();

    expect(component.googleLoginReady()).toBe(false);
    expect(component.globalError()).toBe(
      'Google Login no está disponible para este origen. Revisá la configuración del cliente.',
    );
  });
});
