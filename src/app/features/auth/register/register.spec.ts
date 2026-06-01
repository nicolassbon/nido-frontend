import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

class MockAuthService {
  register = vi.fn();
}

describe('Register Component', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let mockAuthService: MockAuthService;

  beforeEach(async () => {
    mockAuthService = new MockAuthService();

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        ...appConfig.providers,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create successfully', () => {
    expect(component).toBeTruthy();
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

    // missing number and capital
    passwordControl.setValue('weakpass');
    expect(passwordControl.valid).toBe(false);
    expect(passwordControl.errors?.['pattern']).toBeTruthy();

    // missing capital
    passwordControl.setValue('weakpass1');
    expect(passwordControl.valid).toBe(false);

    // missing number
    passwordControl.setValue('Weakpass');
    expect(passwordControl.valid).toBe(false);

    // valid
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

    const mockResponse = {
      usuarioId: 'u-1',
      hogarId: 'h-1',
      accessToken: 'token-jwt',
    };
    mockAuthService.register.mockReturnValue(of(mockResponse));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
    });

    component.onSubmit();

    expect(component.submitted()).toBe(true);
    expect(mockAuthService.register).toHaveBeenCalledWith({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      sexo: 'Masculino',
      foto: null,
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
    });

    component.onSubmit();

    expect(mockAuthService.register).toHaveBeenCalledWith({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      sexo: 'Masculino',
      foto: file,
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

  it('should handle 409 email already exists error', () => {
    const mockError = { status: 409, message: 'Conflict' };
    mockAuthService.register.mockReturnValue(throwError(() => mockError));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Este email ya está registrado.');
    expect(component.loading()).toBe(false);
  });

  it('should handle 400 validation error', () => {
    const mockError = { status: 400, message: 'Bad Request' };
    mockAuthService.register.mockReturnValue(throwError(() => mockError));

    component.form.patchValue({
      nombre: 'Nico',
      email: 'nico@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      sexo: 'Masculino',
    });

    component.onSubmit();

    expect(component.globalError()).toBe('Verificá los datos ingresados.');
  });
});
