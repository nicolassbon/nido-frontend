import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ForgotPassword } from './forgot-password';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

describe('ForgotPassword', () => {
  let component: ForgotPassword;
  let fixture: ComponentFixture<ForgotPassword>;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      forgotPassword: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPassword, ReactiveFormsModule, LucideAngularModule],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate email field as required and email format', () => {
    const emailCtrl = component.form.controls.email;
    expect(emailCtrl.valid).toBeFalsy();

    emailCtrl.setValue('');
    expect(emailCtrl.hasError('required')).toBeTruthy();

    emailCtrl.setValue('invalid-email');
    expect(emailCtrl.hasError('email')).toBeTruthy();

    emailCtrl.setValue('test@example.com');
    expect(emailCtrl.valid).toBeTruthy();
  });

  it('should call AuthService.forgotPassword on submit and set success to true on success', () => {
    component.form.controls.email.setValue('test@example.com');
    mockAuthService.forgotPassword.mockReturnValue(of({ message: 'Success' }));

    component.onSubmit();

    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(component.success()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should handle error and set globalError on submission failure', () => {
    component.form.controls.email.setValue('test@example.com');
    mockAuthService.forgotPassword.mockReturnValue(throwError(() => new Error('API Error')));

    component.onSubmit();

    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(component.success()).toBe(false);
    expect(component.globalError()).toBe('Ocurrió un error al enviar el correo. Intentá de nuevo.');
    expect(component.loading()).toBe(false);
  });
});
