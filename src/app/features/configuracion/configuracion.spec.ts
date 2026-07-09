import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Configuracion } from './configuracion';
import { AuthService } from '../../core/auth/auth.service';
import { PerfilApiService } from '../perfil/perfil-api.service';
import { PreferenciasApiService } from '../alacena/preferencias-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { appConfig } from '../../app.config';
import { SwPush } from '@angular/service-worker';
import { NotificacionesApiService } from '../notificaciones/services/notificaciones-api.service';
import { TelegramApiService } from '../telegram/telegram-api';

describe('Configuracion', () => {
  let component: Configuracion;
  let fixture: ComponentFixture<Configuracion>;
  let mockAuthService: any;
  let mockPerfilApiService: any;
  let mockPreferenciasApiService: any;
  let mockHogaresApiService: any;
  let mockSwPush: any;
  let mockNotificacionesApiService: any;
  let mockTelegramApiService: any;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();

    mockAuthService = {
      changePassword: vi.fn(),
      addPassword: vi.fn(),
      getNombre: vi.fn().mockReturnValue('Test User'),
      getEmail: vi.fn().mockReturnValue('test@example.com'),
      getUserId: vi.fn().mockReturnValue('u-1'),
      getHogarId: vi.fn().mockReturnValue('h-1'),
      setToken: vi.fn(),
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
      getPreferences: vi.fn().mockReturnValue(of({ diasAlerta: 7, temaPreferido: 'system' })),
      updatePreferences: vi.fn().mockReturnValue(of({ diasAlerta: 7, temaPreferido: 'system' })),
      updateTheme: vi.fn().mockReturnValue(of({ diasAlerta: 7, temaPreferido: 'system' })),
    };

    mockHogaresApiService = {
      getMiembros: vi.fn().mockReturnValue(of([
        { usuarioId: 'u-1', nombre: 'Test User', email: 'test@example.com', rol: 'owner', fotoUrl: null, alergias: [] }
      ])),
      getMisHogares: vi.fn().mockReturnValue(of([
        { id: 'h-1', nombre: 'Mi hogar', rol: 'owner' },
      ])),
      activarHogar: vi.fn(),
      crearHogar: vi.fn(),
      renombrarHogar: vi.fn(),
      eliminarHogar: vi.fn(),
      invitar: vi.fn().mockReturnValue(of({ token: 'mock-token' })),
    };

    mockSwPush = {
      isEnabled: false,
      subscription: of(null),
      requestSubscription: vi.fn(),
      unsubscribe: vi.fn(),
    };

    mockNotificacionesApiService = {
      subscribePush: vi.fn().mockReturnValue(of(undefined)),
    };

    mockTelegramApiService = {
      startPairing: vi.fn().mockReturnValue(of({
        deepLinkUrl: 'https://t.me/nido_app_bot?start=abc123',
        pairingCode: 'ABC123',
        expiresAt: '2026-06-19T12:00:00.000Z',
      })),
      getStatus: vi.fn().mockReturnValue(of({ isLinked: false })),
      unlink: vi.fn(),
    };

    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => window);

    await TestBed.configureTestingModule({
      imports: [Configuracion, ReactiveFormsModule, LucideAngularModule],
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: mockAuthService },
        { provide: PerfilApiService, useValue: mockPerfilApiService },
        { provide: PreferenciasApiService, useValue: mockPreferenciasApiService },
        { provide: HogaresApiService, useValue: mockHogaresApiService },
        { provide: SwPush, useValue: mockSwPush },
        { provide: NotificacionesApiService, useValue: mockNotificacionesApiService },
        { provide: TelegramApiService, useValue: mockTelegramApiService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Configuracion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  const findButton = (text: string): HTMLButtonElement | null => {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    return Array.from(buttons).find((button) => button.textContent?.includes(text)) ?? null;
  };

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

      mockAuthService.changePassword.mockReturnValue(throwError(() => ({ status: 401, error: { title: 'INVALID_CREDENTIALS' } })));

      component.onChangePasswordSubmit();

      expect(component.globalError()).toBe('La contraseña actual no coincide con tu contraseña vigente.');
    });

    it('should invalidate the form when the new password matches the current one', () => {
      const form = component.changePasswordForm;
      form.controls.currentPassword.setValue('Current1!');
      form.controls.newPassword.setValue('Current1!');
      form.controls.confirmPassword.setValue('Current1!');

      expect(form.valid).toBe(false);
      expect(form.errors?.['sameAsCurrent']).toBe(true);
    });

    it('should show a dedicated error when backend rejects same password reuse', () => {
      const form = component.changePasswordForm;
      form.controls.currentPassword.setValue('Current1!');
      form.controls.newPassword.setValue('NewPwd123!');
      form.controls.confirmPassword.setValue('NewPwd123!');
      mockAuthService.changePassword.mockReturnValue(throwError(() => ({ status: 400, error: { title: 'PASSWORD_SAME_AS_CURRENT' } })));

      component.onChangePasswordSubmit();

      expect(component.globalError()).toBe('La nueva contraseña no puede ser igual a la actual.');
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

    it('should mark add-password form as submitted when invalid so validations become visible', () => {
      component.onAddPasswordSubmit();

      expect(component.addSubmitted()).toBe(true);
      expect(mockAuthService.addPassword).not.toHaveBeenCalled();
    });

    it('should toggle password visibility for add-password inputs', () => {
      expect(component.showAddNewPassword()).toBe(false);
      expect(component.showAddConfirmPassword()).toBe(false);

      component.togglePasswordVisibility('addNew');
      component.togglePasswordVisibility('addConfirm');

      expect(component.showAddNewPassword()).toBe(true);
      expect(component.showAddConfirmPassword()).toBe(true);
    });
  });

  describe('Telegram pairing flow', () => {
    it('should start pairing, open Telegram, and expose the fallback code', () => {
      component.connectTelegram();

      expect(mockTelegramApiService.startPairing).toHaveBeenCalled();
      expect(windowOpenSpy).toHaveBeenCalledWith('https://t.me/nido_app_bot?start=abc123', '_blank', 'noopener,noreferrer');
      expect(component.telegramPairingStatus()).toBe('success');
      expect(component.telegramPairingCode()).toBe('ABC123');
      expect(component.telegramPairingMessage()).toContain('Abrimos Telegram');
    });

    it('should show a truthful fallback message when the popup is blocked', () => {
      windowOpenSpy.mockImplementationOnce(() => null);

      component.connectTelegram();

      expect(component.telegramPairingStatus()).toBe('success');
      expect(component.telegramPairingCode()).toBe('ABC123');
      expect(component.telegramPairingMessage()).toBe(
        'No pudimos abrir Telegram automáticamente. Abrí este enlace: https://t.me/nido_app_bot?start=abc123 o usá el código ABC123.'
      );
    });

    it('should show a friendly message when pairing is rate limited', () => {
      mockTelegramApiService.startPairing.mockReturnValue(
        throwError(() => ({ status: 429, error: { title: 'TELEGRAM_PAIRING_RATE_LIMIT_EXCEEDED' } }))
      );

      component.connectTelegram();

      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(component.telegramPairingStatus()).toBe('error');
      expect(component.telegramPairingMessage()).toBe('Ya generaste un intento hace poco. Esperá un momento y volvé a probar.');
    });

    it('should show a friendly message when Telegram is not configured', () => {
      mockTelegramApiService.startPairing.mockReturnValue(
        throwError(() => ({ status: 503, error: { title: 'TELEGRAM_CONFIGURATION' } }))
      );

      component.connectTelegram();

      expect(component.telegramPairingStatus()).toBe('error');
      expect(component.telegramPairingMessage()).toBe('Telegram no está disponible en este momento. Intentá nuevamente más tarde.');
    });

    it('should show the generic Telegram pairing error fallback message', () => {
      mockTelegramApiService.startPairing.mockReturnValue(
        throwError(() => ({ status: 500, error: { title: 'UNEXPECTED_ERROR' } }))
      );

      component.connectTelegram();

      expect(component.telegramPairingStatus()).toBe('error');
      expect(component.telegramPairingMessage()).toBe('No pudimos iniciar la vinculación con Telegram. Intentá de nuevo.');
    });

    it('should reject invalid Telegram deep links before opening them', () => {
      mockTelegramApiService.startPairing.mockReturnValue(
        of({
          deepLinkUrl: 'https://t.me/other_bot?start=abc123',
          pairingCode: 'ABC123',
          expiresAt: '2026-06-19T12:00:00.000Z',
        })
      );

      component.connectTelegram();

      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(component.telegramPairingStatus()).toBe('error');
      expect(component.telegramPairingMessage()).toBe('No pudimos abrir Telegram porque el enlace devuelto no es válido. Probá de nuevo.');
    });
  });

  describe('Telegram status and disconnect flow', () => {
    it('should load Telegram status when the component loads', () => {
      expect(mockTelegramApiService.getStatus).toHaveBeenCalled();
      expect(component.telegramIsLinked()).toBe(false);
    });

    it('should render the disconnect button when Telegram is linked', () => {
      mockTelegramApiService.getStatus.mockReturnValue(of({
        isLinked: true,
        chatId: 12345,
        pairedAt: '2026-06-19T12:00:00.000Z',
      }));

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.telegramIsLinked()).toBe(true);
      expect(findButton('Desconectar')).toBeTruthy();
    });

    it('should let the user verify Telegram connection after pairing and refresh the linked state', () => {
      mockTelegramApiService.getStatus.mockReturnValueOnce(of({ isLinked: false }));

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.connectTelegram();
      fixture.detectChanges();

      const verifyButton = findButton('Verificar conexión');
      expect(verifyButton).toBeTruthy();

      mockTelegramApiService.getStatus.mockReturnValueOnce(of({
        isLinked: true,
        chatId: 12345,
        pairedAt: '2026-06-19T12:30:00.000Z',
      }));

      verifyButton?.click();
      fixture.detectChanges();

      expect(component.telegramIsLinked()).toBe(true);
      expect(findButton('Desconectar')).toBeTruthy();
    });

    it('should preserve the last known Telegram link state when status refresh fails', () => {
      mockTelegramApiService.getStatus
        .mockReturnValueOnce(of({
          isLinked: true,
          chatId: 12345,
          pairedAt: '2026-06-19T12:00:00.000Z',
        }))
        .mockReturnValueOnce(throwError(() => ({ status: 503, error: { title: 'TELEGRAM_STATUS_UNAVAILABLE' } })));

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.refreshTelegramStatus();
      fixture.detectChanges();

      expect(component.telegramIsLinked()).toBe(true);
      expect(component.telegramStatusError()).toBe(
        'No pudimos comprobar el estado de Telegram. Conservamos la última conexión conocida. Probá de nuevo en unos segundos.'
      );
      expect(findButton('Desconectar')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(
        'No pudimos comprobar el estado de Telegram. Conservamos la última conexión conocida. Probá de nuevo en unos segundos.'
      );
    });

    it('should clear stale pairing instructions after disconnecting Telegram', () => {
      mockTelegramApiService.getStatus.mockReturnValue(of({
        isLinked: true,
        chatId: 12345,
        pairedAt: '2026-06-19T12:00:00.000Z',
      }));
      mockTelegramApiService.unlink.mockReturnValue(of({
        chatId: 12345,
        unpairedAt: '2026-06-19T13:00:00.000Z',
      }));

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.telegramPairingMessage.set('Abrimos Telegram para completar la vinculación.');
      component.telegramPairingCode.set('ABC123');

      findButton('Desconectar')?.click();
      fixture.detectChanges();

      expect(mockTelegramApiService.unlink).toHaveBeenCalled();
      expect(component.telegramIsLinked()).toBe(false);
      expect(component.telegramPairingMessage()).toBeNull();
      expect(component.telegramPairingCode()).toBeNull();
      expect(findButton('Conectar Telegram')).toBeTruthy();
    });

    it('should clear any previous unlink success timer before a later unlink cycle settles', () => {
      vi.useFakeTimers();

      try {
        const secondUnlink$ = new Subject<{ chatId: number; unpairedAt: string }>();

        mockTelegramApiService.getStatus.mockReturnValue(of({
          isLinked: true,
          chatId: 12345,
          pairedAt: '2026-06-19T12:00:00.000Z',
        }));
        mockTelegramApiService.unlink
          .mockReturnValueOnce(of({
            chatId: 12345,
            unpairedAt: '2026-06-19T13:00:00.000Z',
          }))
          .mockReturnValueOnce(secondUnlink$.asObservable());

        fixture = TestBed.createComponent(Configuracion);
        component = fixture.componentInstance;
        fixture.detectChanges();

        component.disconnectTelegram();
        expect(component.telegramUnlinkStatus()).toBe('success');

        component.disconnectTelegram();

        expect(mockTelegramApiService.unlink).toHaveBeenCalledTimes(2);
        expect(component.telegramUnlinkStatus()).toBe('loading');

        vi.advanceTimersByTime(2500);

        expect(component.telegramUnlinkStatus()).toBe('loading');

        secondUnlink$.next({
          chatId: 12345,
          unpairedAt: '2026-06-19T13:05:00.000Z',
        });
        secondUnlink$.complete();

        expect(component.telegramUnlinkStatus()).toBe('success');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should ignore stale Telegram status responses after unlinking', () => {
      const staleStatus$ = new Subject<{ isLinked: boolean; chatId?: number; pairedAt?: string }>();

      mockTelegramApiService.getStatus
        .mockReturnValueOnce(staleStatus$.asObservable())
        .mockReturnValue(of({ isLinked: false }));

      mockTelegramApiService.unlink.mockReturnValue(of({
        chatId: 12345,
        unpairedAt: '2026-06-19T13:00:00.000Z',
      }));

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.disconnectTelegram();

      expect(mockTelegramApiService.unlink).toHaveBeenCalled();
      expect(component.telegramIsLinked()).toBe(false);

      staleStatus$.next({
        isLinked: true,
        chatId: 12345,
        pairedAt: '2026-06-19T12:30:00.000Z',
      });
      staleStatus$.complete();

      expect(component.telegramIsLinked()).toBe(false);
    });

    it('should show a friendly error when unlink fails with 404', () => {
      mockTelegramApiService.getStatus.mockReturnValue(of({
        isLinked: true,
        chatId: 12345,
        pairedAt: '2026-06-19T12:00:00.000Z',
      }));
      mockTelegramApiService.unlink.mockReturnValue(
        throwError(() => ({ status: 404, error: {} }))
      );

      fixture = TestBed.createComponent(Configuracion);
      component = fixture.componentInstance;
      fixture.detectChanges();

      findButton('Desconectar')?.click();
      fixture.detectChanges();

      expect(component.telegramUnlinkStatus()).toBe('error');
      expect(component.telegramIsLinked()).toBe(false);
      expect(component.telegramUnlinkError()).toBe('No encontramos una cuenta de Telegram vinculada.');
      expect(findButton('Conectar Telegram')).toBeTruthy();
      expect(findButton('Desconectar')).toBeNull();
    });
  });

  describe('Mis hogares', () => {
    it('should load hogares on init and reflect hogarActivoId from token', () => {
      expect(mockHogaresApiService.getMisHogares).toHaveBeenCalled();
      expect(component.hogares()).toEqual([{ id: 'h-1', nombre: 'Mi hogar', rol: 'owner' }]);
      expect(component.hogarActivoId()).toBe('h-1');
    });

    it('activarHogar() sets new token, updates hogarActivoId and reloads members', () => {
      mockHogaresApiService.activarHogar.mockReturnValue(of({
        hogarId: 'h-2',
        hogarNombre: 'Casa verano',
        accessToken: 'new-jwt',
      }));

      component.activarHogar('h-2');

      expect(mockHogaresApiService.activarHogar).toHaveBeenCalledWith('h-2');
      expect(mockAuthService.setToken).toHaveBeenCalledWith('new-jwt');
      expect(component.hogarActivoId()).toBe('h-2');
      expect(mockHogaresApiService.getMiembros).toHaveBeenCalledTimes(2);
    });

    it('activarHogar() does nothing when hogar is already active', () => {
      component.activarHogar('h-1');
      expect(mockHogaresApiService.activarHogar).not.toHaveBeenCalled();
    });

    it('openEditHogar() sets editingHogarId and editHogarNombre', () => {
      component.openEditHogar({ id: 'h-1', nombre: 'Mi hogar', rol: 'owner' });
      expect(component.editingHogarId()).toBe('h-1');
      expect(component.editHogarNombre()).toBe('Mi hogar');
    });

    it('cancelEditHogar() clears editing state', () => {
      component.openEditHogar({ id: 'h-1', nombre: 'Mi hogar', rol: 'owner' });
      component.cancelEditHogar();
      expect(component.editingHogarId()).toBeNull();
      expect(component.editHogarNombre()).toBe('');
    });

    it('saveEditHogar() calls renombrarHogar and updates hogares signal locally', () => {
      mockHogaresApiService.renombrarHogar.mockReturnValue(of({ id: 'h-1', nombre: 'Hogar renombrado' }));
      component.openEditHogar({ id: 'h-1', nombre: 'Mi hogar', rol: 'owner' });
      component.editHogarNombre.set('Hogar renombrado');

      component.saveEditHogar();

      expect(mockHogaresApiService.renombrarHogar).toHaveBeenCalledWith('h-1', 'Hogar renombrado');
      expect(component.hogares()[0].nombre).toBe('Hogar renombrado');
      expect(component.editingHogarId()).toBeNull();
    });

    it('saveEditHogar() shows error on failure', () => {
      mockHogaresApiService.renombrarHogar.mockReturnValue(
        throwError(() => ({ error: { message: 'Nombre inválido' } }))
      );
      component.openEditHogar({ id: 'h-1', nombre: 'Mi hogar', rol: 'owner' });
      component.editHogarNombre.set('x');

      component.saveEditHogar();

      expect(component.renameHogarError()).toBe('Nombre inválido');
    });

    it('confirmarEliminarHogar() calls eliminarHogar and reloads hogares', () => {
      mockHogaresApiService.eliminarHogar.mockReturnValue(of(undefined));
      component.openEliminarHogarConfirm({ id: 'h-2', nombre: 'Casa verano', rol: 'owner' });

      component.confirmarEliminarHogar();

      expect(mockHogaresApiService.eliminarHogar).toHaveBeenCalledWith('h-2');
      expect(component.hogarToDelete()).toBeNull();
      expect(mockHogaresApiService.getMisHogares).toHaveBeenCalledTimes(2);
    });

    it('confirmarEliminarHogar() shows error on failure', () => {
      mockHogaresApiService.eliminarHogar.mockReturnValue(
        throwError(() => ({ error: { detail: 'No se puede eliminar el hogar activo.' } }))
      );
      component.openEliminarHogarConfirm({ id: 'h-2', nombre: 'Casa verano', rol: 'owner' });

      component.confirmarEliminarHogar();

      expect(component.deleteHogarError()).toBe('No se puede eliminar el hogar activo.');
    });

    it('submitCrearHogar() creates hogar, sets token, updates hogarActivoId and reloads hogares', () => {
      mockHogaresApiService.crearHogar.mockReturnValue(of({
        hogarId: 'h-3',
        hogarNombre: 'Nuevo hogar',
        accessToken: 'jwt-nuevo',
      }));
      component.crearHogarNombre.set('Nuevo hogar');

      component.submitCrearHogar();

      expect(mockHogaresApiService.crearHogar).toHaveBeenCalledWith('Nuevo hogar');
      expect(mockAuthService.setToken).toHaveBeenCalledWith('jwt-nuevo');
      expect(component.hogarActivoId()).toBe('h-3');
      expect(component.crearHogarState()).toBe('success');
      expect(component.crearHogarNombreCreado()).toBe('Nuevo hogar');
      expect(mockHogaresApiService.getMisHogares).toHaveBeenCalledTimes(2);
    });

    it('submitCrearHogar() does nothing when name is blank', () => {
      component.crearHogarNombre.set('   ');
      component.submitCrearHogar();
      expect(mockHogaresApiService.crearHogar).not.toHaveBeenCalled();
    });

    it('submitCrearHogar() shows error on failure', () => {
      mockHogaresApiService.crearHogar.mockReturnValue(
        throwError(() => ({ error: { message: 'El nombre ya existe' } }))
      );
      component.crearHogarNombre.set('Hogar duplicado');

      component.submitCrearHogar();

      expect(component.crearHogarState()).toBe('error');
      expect(component.crearHogarErrorMsg()).toBe('El nombre ya existe');
    });
  });
});
