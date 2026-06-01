import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Configuracion } from './configuracion';
import { AuthService } from '../../core/auth/auth.service';
import { PerfilApiService } from '../perfil/perfil-api.service';
import { PreferenciasApiService } from '../alacena/preferencias-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { appConfig } from '../../app.config';

describe('Configuracion', () => {
  let component: Configuracion;
  let fixture: ComponentFixture<Configuracion>;
  let mockAuthService: any;
  let mockPerfilApiService: any;
  let mockPreferenciasApiService: any;
  let mockHogaresApiService: any;

  beforeEach(async () => {
    mockAuthService = {
      changePassword: vi.fn(),
      addPassword: vi.fn(),
      getNombre: vi.fn().mockReturnValue('Test User'),
      getEmail: vi.fn().mockReturnValue('test@example.com'),
      getUserId: vi.fn().mockReturnValue('u-1'),
      logout: vi.fn().mockReturnValue(of(undefined)),
    };

    mockPerfilApiService = {
      getProfile: vi.fn().mockReturnValue(of({
        nombre: 'Test Nico',
        email: 'test@example.com',
        hasPassword: true,
        hasGoogleLinked: true,
      })),
    };

    mockPreferenciasApiService = {
      getPreferences: vi.fn().mockReturnValue(of({ diasAlerta: 7 })),
      updatePreferences: vi.fn().mockReturnValue(of({ diasAlerta: 7 })),
    };

    mockHogaresApiService = {
      getMiembros: vi.fn().mockReturnValue(of([
        { usuarioId: 'u-1', nombre: 'Test User', email: 'test@example.com', rol: 'owner', fotoUrl: null }
      ])),
      invitar: vi.fn().mockReturnValue(of({ token: 'mock-token' })),
    };

    await TestBed.configureTestingModule({
      imports: [Configuracion, ReactiveFormsModule, LucideAngularModule],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: PerfilApiService, useValue: mockPerfilApiService },
        { provide: PreferenciasApiService, useValue: mockPreferenciasApiService },
        { provide: HogaresApiService, useValue: mockHogaresApiService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Configuracion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load profile successfully', () => {
    expect(component).toBeTruthy();
    expect(mockPerfilApiService.getProfile).toHaveBeenCalled();
    expect(component.hasPassword()).toBe(true);
    expect(component.hasGoogleLinked()).toBe(true);
  });

  describe('Change Password Flow (hasPassword: true)', () => {
    it('should show Change Password form controls and validate inputs', () => {
      const form = component.changePasswordForm;
      expect(form.valid).toBeFalsy();

      form.controls.currentPassword.setValue('Current1!');
      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');
      expect(form.valid).toBeTruthy();
    });

    it('should call AuthService.changePassword and reset form on success', () => {
      const form = component.changePasswordForm;
      form.controls.currentPassword.setValue('Current1!');
      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');

      mockAuthService.changePassword.mockReturnValue(of({ message: 'Success' }));

      component.onChangePasswordSubmit();

      expect(mockAuthService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'Current1!',
        newPassword: 'NewPwd123!',
        newPasswordConfirmation: 'NewPwd123!',
      });
      expect(component.globalSuccess()).toBe('¡Tu contraseña ha sido cambiada con éxito!');
      expect(form.controls.newPassword.value).toBe('');
    });

    it('should show error when change password fails', () => {
      const form = component.changePasswordForm;
      form.controls.currentPassword.setValue('Current1!');
      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');

      mockAuthService.changePassword.mockReturnValue(throwError(() => ({ status: 400 })));

      component.onChangePasswordSubmit();

      expect(component.globalError()).toBe('La contraseña actual es incorrecta o la nueva contraseña no cumple con las reglas de complejidad.');
    });
  });

  describe('Add Password Flow (hasPassword: false)', () => {
    beforeEach(() => {
      // Simulate Google-only account
      mockPerfilApiService.getProfile.mockReturnValue(of({
        nombre: 'Test Nico',
        email: 'test@example.com',
        hasPassword: false,
        hasGoogleLinked: true,
      }));
      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should show Create Password form and require only new/confirm passwords', () => {
      expect(component.hasPassword()).toBe(false);
      const form = component.addPasswordForm;
      expect(form.valid).toBeFalsy();

      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');
      expect(form.valid).toBeTruthy();
    });

    it('should call AuthService.addPassword and switch hasPassword flag on success', () => {
      const form = component.addPasswordForm;
      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');

      mockAuthService.addPassword.mockReturnValue(of({ message: 'Success' }));

      component.onAddPasswordSubmit();

      expect(mockAuthService.addPassword).toHaveBeenCalledWith({
        newPassword: 'NewPwd123!',
        newPasswordConfirmation: 'NewPwd123!',
      });
      expect(component.globalSuccess()).toBe('¡Tu contraseña de acceso ha sido creada con éxito!');
      expect(component.hasPassword()).toBe(true); // Should switch to Change Password form view
    });
  });
});
