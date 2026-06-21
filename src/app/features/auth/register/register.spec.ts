import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Register } from './register';
import { AuthService, type GoogleLoginResponse } from '../../../core/auth/auth.service';
import { GoogleIdentityService } from '../../../core/auth/google-identity.service';
import { appConfig } from '../../../app.config';

class MockAuthService {
  register = vi.fn();
  googleLogin = vi.fn();
}

class MockGoogleIdentityService {
  private credentialHandler: ((idToken: string) => void) | null = null;

  renderButton = vi.fn(async (_host: HTMLElement, onCredential: (idToken: string) => void) => {
    this.credentialHandler = onCredential;
  });

  emitCredential(idToken: string): void {
    this.credentialHandler?.(idToken);
  }
}

describe('Register Component', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let mockAuthService: MockAuthService;
  let mockGoogleIdentityService: MockGoogleIdentityService;

  beforeEach(async () => {
    mockAuthService = new MockAuthService();
    mockGoogleIdentityService = new MockGoogleIdentityService();

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        ...appConfig.providers,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: GoogleIdentityService, useValue: mockGoogleIdentityService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create successfully', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the Google button on render', () => {
    expect(mockGoogleIdentityService.renderButton).toHaveBeenCalledTimes(1);
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

  it('should validate password complexity regex', () => {
    const passwordControl = component.form.controls.password;

    passwordControl.setValue('weakpass');
    expect(passwordControl.valid).toBe(false);
    expect(passwordControl.errors?.['pattern']).toBeTruthy();

    passwordControl.setValue('weakpass1');
    expect(passwordControl.valid).toBe(false);

    passwordControl.setValue('Weakpass');
    expect(passwordControl.valid).toBe(false);

    passwordControl.setValue('ValidPass1!');
    expect(passwordControl.valid).toBe(true);
  });

  it('should validate that password and confirmPassword match', () => {
    component.form.patchValue({
      password: 'Password1!',
      confirmPassword: 'Password2!',
    });

    expect(component.form.errors?.['passwordMismatch']).toBeTruthy();

    component.form.patchValue({
      confirmPassword: 'Password1!',
    });

    expect(component.form.errors).toBeNull();
  });

  it('should toggle password visibility signals', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePassword();
    expect(component.showPassword()).toBe(true);

    expect(component.showConfirmPassword()).toBe(false);
    component.toggleConfirmPassword();
    expect(component.showConfirmPassword()).toBe(true);
  });

  it('should not trigger register service when form is invalid', () => {
    component.onSubmit();

    expect(component.submitted()).toBe(true);
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should update submitted state and trigger register service on submit success', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    mockAuthService.register.mockReturnValue(of({
      usuarioId: 'u-1',
      hogarId: 'h-1',
      accessToken: 'token-jwt',
      message: 'Registration completed.',
      isSilentSuccess: false,
    }));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
      aceptaTerminos: true,
    });

    component.onSubmit();

    expect(component.submitted()).toBe(true);
    expect(mockAuthService.register).toHaveBeenCalledWith({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      sexo: 'Masculino',
      foto: null,
      aceptaTerminos: true,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/crear-hogar']);
  });

  it('should submit the selected profile photo when present', () => {
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    mockAuthService.register.mockReturnValue(of({
      usuarioId: 'u-1',
      hogarId: 'h-1',
      accessToken: 'token-jwt',
      message: 'Registration completed.',
      isSilentSuccess: false,
    }));

    component.onPhotoSelected({
      target: {
        files: [file],
        value: 'avatar.webp',
      },
    } as unknown as Event);

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
      aceptaTerminos: true,
    });

    component.onSubmit();

    expect(mockAuthService.register).toHaveBeenCalledWith({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      sexo: 'Masculino',
      foto: file,
      aceptaTerminos: true,
    });

    createObjectURLSpy.mockRestore();
  });

  it('should store a valid selected profile photo and create preview', () => {
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');

    component.onPhotoSelected({
      target: {
        files: [file],
        value: 'avatar.webp',
      },
    } as unknown as Event);

    expect(component.selectedPhoto()).toBe(file);
    expect(component.photoPreview()).toBe('blob:preview');
    expect(component.photoError()).toBeNull();

    createObjectURLSpy.mockRestore();
  });

  it('should reject unsupported profile photo types', () => {
    const file = new File(['avatar'], 'avatar.gif', { type: 'image/gif' });

    component.onPhotoSelected({
      target: {
        files: [file],
        value: 'avatar.gif',
      },
    } as unknown as Event);

    expect(component.selectedPhoto()).toBeNull();
    expect(component.photoPreview()).toBeNull();
    expect(component.photoError()).toBe('Usá una imagen JPG, PNG o WebP.');
  });

  it('should reject profile photos larger than 5 MB', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png', { type: 'image/png' });

    component.onPhotoSelected({
      target: {
        files: [file],
        value: 'avatar.png',
      },
    } as unknown as Event);

    expect(component.selectedPhoto()).toBeNull();
    expect(component.photoPreview()).toBeNull();
    expect(component.photoError()).toBe('La imagen no puede superar los 5 MB.');
  });

  it('should revoke the preview URL when the component is destroyed', () => {
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.onPhotoSelected({
      target: {
        files: [file],
        value: 'avatar.webp',
      },
    } as unknown as Event);

    fixture.destroy();

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:preview');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('should show a generic inline error when register returns silent success', () => {
    mockAuthService.register.mockReturnValue(of({
      usuarioId: null,
      hogarId: null,
      accessToken: null,
      message: 'Generic response.',
      isSilentSuccess: true,
    }));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
      aceptaTerminos: true,
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Ocurrió un error al procesar el registro. Intentá de nuevo más tarde.');
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.confirmPassword.value).toBe('');
    expect(component.loading()).toBe(false);
  });

  it('should handle 400 validation error', () => {
    mockAuthService.register.mockReturnValue(throwError(() => ({ status: 400 })));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
      aceptaTerminos: true,
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Verificá los datos ingresados.');
  });

  it('should navigate to / when onLogoClick is called', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.onLogoClick();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('should exchange the Google credential with the backend and redirect to home for existing users', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const mockResponse: GoogleLoginResponse = {
      usuarioId: 'u-google',
      hogarId: 'h-google',
      accessToken: 'google-token-jwt',
      isNewUser: false,
    };
    mockAuthService.googleLogin.mockReturnValue(of(mockResponse));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(mockAuthService.googleLogin).toHaveBeenCalledWith('real-google-id-token');
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBe(false);
  });

  it('should redirect new Google users to /crear-hogar', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const mockResponse: GoogleLoginResponse = {
      usuarioId: 'u-google-new',
      hogarId: 'h-google-new',
      accessToken: 'google-token-jwt-new',
      isNewUser: true,
    };
    mockAuthService.googleLogin.mockReturnValue(of(mockResponse));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(mockAuthService.googleLogin).toHaveBeenCalledWith('real-google-id-token');
    expect(navigateSpy).toHaveBeenCalledWith(['/crear-hogar']);
    expect(component.loading()).toBe(false);
  });

  it('should handle Google login failure', () => {
    mockAuthService.googleLogin.mockReturnValue(throwError(() => ({ status: 400 })));

    mockGoogleIdentityService.emitCredential('real-google-id-token');

    expect(component.globalError()).toBe('Error al iniciar sesión con Google.');
    expect(component.loading()).toBe(false);
  });
});
