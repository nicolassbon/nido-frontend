import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ResetPassword } from './reset-password';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

describe('ResetPassword', () => {
  let component: ResetPassword;
  let fixture: ComponentFixture<ResetPassword>;
  let mockAuthService: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockAuthService = {
      resetPassword: vi.fn(),
    };

    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue('valid-token'),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [ResetPassword, ReactiveFormsModule, LucideAngularModule],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.noTokenError()).toBe(false);
  });

  it('should set noTokenError to true if token is missing', () => {
    mockActivatedRoute.snapshot.queryParamMap.get.mockReturnValue(null);
    const testFixture = TestBed.createComponent(ResetPassword);
    const testComponent = testFixture.componentInstance;
    expect(testComponent.noTokenError()).toBe(true);
  });

  it('should validate password complexity and mismatch', () => {
    const form = component.form;
    const pwdCtrl = form.controls.password;
    const confirmCtrl = form.controls.confirmPassword;

    expect(form.valid).toBeFalsy();

    // Required
    pwdCtrl.setValue('');
    expect(pwdCtrl.hasError('required')).toBeTruthy();

    // Pattern (weak password)
    pwdCtrl.setValue('weak');
    expect(pwdCtrl.hasError('pattern')).toBeTruthy();

    // Match
    pwdCtrl.setValue('Password123!');
    confirmCtrl.setValue('Different123!');
    expect(form.hasError('passwordMismatch')).toBeTruthy();

    confirmCtrl.setValue('Password123!');
    expect(form.valid).toBeTruthy();
  });

  it('should call AuthService.resetPassword on submit and set success to true on success', () => {
    component.form.controls.password.setValue('Password123!');
    component.form.controls.confirmPassword.setValue('Password123!');
    mockAuthService.resetPassword.mockReturnValue(of({ message: 'Success' }));

    component.onSubmit();

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
      token: 'valid-token',
      newPassword: 'Password123!',
      newPasswordConfirmation: 'Password123!',
    });
    expect(component.success()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should handle error and set globalError on 400 validation failure', () => {
    component.form.controls.password.setValue('Password123!');
    component.form.controls.confirmPassword.setValue('Password123!');
    mockAuthService.resetPassword.mockReturnValue(throwError(() => ({ status: 400 })));

    component.onSubmit();

    expect(component.success()).toBe(false);
    expect(component.globalError()).toBe('El enlace de recuperación es inválido o ha expirado. Solicitá uno nuevo.');
    expect(component.loading()).toBe(false);
  });
});
