import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PaywallService } from '../../core/servicios/paywall';
import { HogaresApiService } from '../household/hogares-api.service';
import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import { TareasApiService, type GamificacionProgresoResponse } from '../tareas/services/tareas-api.service';
import { PerfilApiService } from './perfil-api.service';
import { PerfilComponent } from './perfil';
import { PostPaymentReturnService } from '../../core/post-payment-return';

const progress = (overrides: Partial<GamificacionProgresoResponse> = {}): GamificacionProgresoResponse => ({
  usuarioId: 'u-1',
  currentXp: 120,
  currentLevel: 2,
  currentLevelThresholdXp: 100,
  currentLevelNombre: 'Aprendiz',
  nextLevel: 3,
  nextLevelNombre: 'Ayudante',
  nextThresholdXp: 180,
  xpToNextLevel: 60,
  hasNextLevel: true,
  ...overrides,
});

describe('PerfilComponent - Behavior and Gamification', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let mockPerfilApi: any;
  let mockOnboardingApi: any;
  let mockHogaresApi: any;
  let mockTareasApi: any;
  let mockAuthService: any;
  let queryParamsSubject: Subject<any>;
  let refreshCallCount: number;
  let isPremiumSignal: ReturnType<typeof signal<boolean>>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockPostPaymentReturn: {
    clearCheckoutOrigin: ReturnType<typeof vi.fn>;
    redirectAfterConfirmedPayment: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    queryParamsSubject = new Subject();
    refreshCallCount = 0;
    isPremiumSignal = signal(false);
    mockPerfilApi = {
      getProfile: vi.fn().mockReturnValue(of({
        nombre: 'Test User',
        email: 'test@example.com',
        sexo: 'Otro',
        telefono: '12345678',
        fotoUrl: null,
        tareasCompletadas: 5,
        productosEscaneados: 3,
        logros: 10,
        alimentacion: [],
        alergias: [],
      })),
      updateRestricciones: vi.fn().mockReturnValue(of(undefined)),
    };

    mockOnboardingApi = {
      getPreferenciasAlimentarias: vi.fn().mockReturnValue(of([])),
      getAlergias: vi.fn().mockReturnValue(of([])),
    };

    mockHogaresApi = {
      getHogar: vi.fn().mockReturnValue(of({ id: 'h-1', nombre: 'Mi hogar' })),
      invitar: vi.fn().mockReturnValue(of(undefined)),
      crearHogar: vi.fn().mockReturnValue(of({ accessToken: 'token', hogarNombre: 'Nuevo Hogar' })),
    };

    mockTareasApi = {
      getProgreso: vi.fn().mockReturnValue(of(progress())),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };
    mockPostPaymentReturn = {
      clearCheckoutOrigin: vi.fn(),
      redirectAfterConfirmedPayment: vi.fn().mockResolvedValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
          },
        },
        { provide: Router, useValue: mockRouter },
        { provide: PostPaymentReturnService, useValue: mockPostPaymentReturn },
        {
          provide: AuthService,
          useValue: {
            getNombre: () => 'Test User',
            getUserId: () => 'u-1',
            getSubscriptionEndsAt: () => null,
            getTrialEndsAt: () => null,
            isPremium: isPremiumSignal,
            isAuthenticated: vi.fn().mockReturnValue(false),
            refresh: vi.fn().mockImplementation(() => {
              refreshCallCount++;
              if (refreshCallCount >= 3) {
                isPremiumSignal.set(true);
              }
              return of({ accessToken: `new-token-${refreshCallCount}` });
            }),
            setToken: vi.fn(),
          },
        },
        {
          provide: PaywallService,
          useValue: {
            open: vi.fn(),
            close: vi.fn(),
            isOpen: signal(false),
          },
        },
        { provide: PerfilApiService, useValue: mockPerfilApi },
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
        { provide: TareasApiService, useValue: mockTareasApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    mockAuthService = TestBed.inject(AuthService);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('profile level checks', () => {
    it('loads and updates profile level signal from progress API response', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({
        currentXp: 250,
        currentLevel: 4,
        currentLevelNombre: 'Guardián',
        nextLevel: 5,
        nextLevelNombre: 'Maestro',
        nextThresholdXp: 380,
        xpToNextLevel: 130,
      })));

      fixture.detectChanges();

      expect(component['nivelNido']()).toBe(4);
      expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain('Nivel Nido 4');
      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.subtitle).toContain('Guardián');
    });

    it('keeps backend level 0 instead of forcing profile to level 1', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 0, currentXp: 0 })));

      fixture.detectChanges();

      expect(component['nivelNido']()).toBe(0);
      expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain('Nivel Nido Bloqueado');
      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.subtitle).toContain('Compañero Bloqueado');
    });

    it('caps levels greater than max for local companion metadata display', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 6 })));

      fixture.detectChanges();

      expect(component['nivelNido']()).toBe(5);
      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.subtitle).toContain('Maestro');
    });
  });

  describe('backend profile achievements', () => {
    it('uses achievements fallback to 0 when profile logros is undefined', () => {
      mockPerfilApi.getProfile.mockReturnValue(of({
        nombre: 'Test User',
        tareasCompletadas: 5,
        productosEscaneados: 3,
        logros: undefined,
      }));

      fixture.detectChanges();

      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.value).toBe(0);
    });

    it('does not add companion level to backend achievements', () => {
      mockPerfilApi.getProfile.mockReturnValue(of({
        nombre: 'Test User',
        logros: 10,
      }));
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 3 })));

      fixture.detectChanges();

      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.value).toBe(10);
    });
  });

  describe('error handling in subscriptions', () => {
    it('keeps companion locked when progress loading fails', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTareasApi.getProgreso.mockReturnValue(throwError(() => new Error('Progress Error')));

      fixture.detectChanges();

      expect(errSpy).toHaveBeenCalled();
      expect(component['nivelNido']()).toBe(0);
      const trophyCard = component['statCards']().find(c => c.icon === 'trophy');
      expect(trophyCard?.subtitle).toContain('Compañero Bloqueado');

      errSpy.mockRestore();
    });

    it('logs console.error on profile loading failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPerfilApi.getProfile.mockReturnValue(throwError(() => new Error('API Error')));

      fixture.detectChanges();

      expect(errSpy).toHaveBeenCalled();
      expect(component['apiError']()).toBe('No se pudo cargar la información del perfil. Verificá la conexión.');

      errSpy.mockRestore();
    });
  });

  describe('checkout success handling', () => {
    it.each([
      ['a case-folded approved status with whitespace', '  ApPrOvEd  '],
      ['duplicate case-folded success and approved statuses', [' success ', ' APPROVED ']],
    ])('reconciles %s and shows success only after the refreshed JWT is premium', async (_, status) => {
      const refreshResponse = new Subject<{ accessToken: string }>();
      mockAuthService.isAuthenticated.mockReturnValue(true);
      mockAuthService.refresh.mockReturnValue(refreshResponse.asObservable());
      fixture.detectChanges();

      queryParamsSubject.next({ status });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Recibimos tu pago');
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');

      isPremiumSignal.set(true);
      refreshResponse.next({ accessToken: 'premium-token' });
      refreshResponse.complete();
      await flushAsyncWork();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Tu suscripción ya está activa');
      expect(mockPostPaymentReturn.redirectAfterConfirmedPayment).toHaveBeenCalled();
    });

    it('shows payment received guidance until refresh confirms the premium entitlement', async () => {
      const refreshResponse = new Subject<{ accessToken: string }>();
      mockAuthService.refresh.mockReturnValue(refreshResponse.asObservable());
      fixture.detectChanges();

      queryParamsSubject.next({ status: 'success' });
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Recibimos tu pago');
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');

      isPremiumSignal.set(true);
      refreshResponse.next({ accessToken: 'premium-token' });
      refreshResponse.complete();
      await flushAsyncWork();
      fixture.detectChanges();

      const alertEl = fixture.nativeElement.querySelector('.alert-success');
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain('Tu suscripción ya está activa');
    });

    it('consumes the payment status and does not restart reconciliation when the status is removed', () => {
      fixture.detectChanges();

      queryParamsSubject.next({ status: 'pending' });
      queryParamsSubject.next({});
      fixture.detectChanges();

      expect(mockRouter.navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: { status: null },
        replaceUrl: true,
      }));
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Todavía no confirmamos el pago');
    });

    it('gives clear safe guidance for failed or cancelled checkout returns', () => {
      fixture.detectChanges();

      queryParamsSubject.next({ status: 'failure' });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('El pago no se completó');
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
    });

    it('clears the stored origin and shows safe retry guidance for a rejected checkout status', () => {
      fixture.detectChanges();

      queryParamsSubject.next({ status: 'rejected' });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No pudimos confirmar el estado del pago');
      expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
    });

    it('does not show Perfil success when a confirmed payment returns to a stored non-Perfil origin', async () => {
      mockPostPaymentReturn.redirectAfterConfirmedPayment.mockResolvedValue(true);
      mockAuthService.isAuthenticated.mockReturnValue(true);
      fixture.detectChanges();

      isPremiumSignal.set(true);
      queryParamsSubject.next({ status: 'approved' });
      fixture.detectChanges();
      await flushAsyncWork();

      expect(mockPostPaymentReturn.redirectAfterConfirmedPayment).toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');
    });

    it.each([
      ['no stored origin', () => mockPostPaymentReturn.redirectAfterConfirmedPayment.mockResolvedValue(false)],
      ['a Perfil origin', () => mockPostPaymentReturn.redirectAfterConfirmedPayment.mockResolvedValue(false)],
      ['a cancelled navigation', () => mockPostPaymentReturn.redirectAfterConfirmedPayment.mockResolvedValue(false)],
      ['a rejected navigation', () => mockPostPaymentReturn.redirectAfterConfirmedPayment.mockRejectedValue(new Error('Navigation error'))],
    ])('falls back to Perfil inline success after %s', async (_, configureRedirect) => {
      configureRedirect();
      isPremiumSignal.set(true);
      fixture.detectChanges();

      queryParamsSubject.next({ status: 'approved' });
      await flushAsyncWork();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Tu suscripción ya está activa');
      expect(mockPostPaymentReturn.redirectAfterConfirmedPayment).toHaveBeenCalled();
    });

    it('refreshes auth state on init when the user is already authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);
    });

    it('does not refresh auth state on init when the user is not authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);
      fixture.detectChanges();

      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('renders premium/upgrade card based on premium status', () => {
      // Non-premium first
      (mockAuthService.isPremium as any).set(false);
      fixture.detectChanges();

      let upgradeCard = fixture.nativeElement.querySelector('.card-upgrade');
      expect(upgradeCard).toBeTruthy();
      expect(upgradeCard.textContent).toContain('Subir al Plan Hogar');

      // Premium now
      (mockAuthService.isPremium as any).set(true);
      fixture.detectChanges();

      upgradeCard = fixture.nativeElement.querySelector('.card-upgrade');
      expect(upgradeCard).toBeNull();

      const premiumCard = fixture.nativeElement.querySelector('.card-premium');
      expect(premiumCard).toBeTruthy();
      expect(premiumCard.textContent).toContain('Plan Hogar activo');
    });
  });

  describe('checkout success polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('polls refresh until JWT reflects premium subscription', async () => {
      fixture.detectChanges();
      queryParamsSubject.next({ status: 'success' });
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);
      expect(mockAuthService.isPremium()).toBe(false);

      vi.advanceTimersByTime(1500);
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1500);
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(3);
      expect(mockAuthService.isPremium()).toBe(true);
      await flushAsyncWork();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Tu suscripción ya está activa');

      // Once premium is detected polling must stop.
      vi.advanceTimersByTime(10000);
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(3);
    });

    it('shows retry guidance after bounded refresh attempts are exhausted', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.refresh.mockReturnValue(NEVER);

      fixture.detectChanges();
      queryParamsSubject.next({ status: 'success' });
      fixture.detectChanges();

      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(6);
      expect(fixture.nativeElement.textContent).toContain(
        'no pudimos verificar la activación por un problema de conexión',
      );
      expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('[PerfilComponent.paymentRefresh Error]', {
        reason: 'timeout',
      });

      errorSpy.mockRestore();
    });

    it('keeps pending activation guidance when refresh succeeds without a premium JWT', () => {
      mockAuthService.refresh.mockReturnValue(of({ accessToken: 'basic-token' }));

      fixture.detectChanges();
      queryParamsSubject.next({ status: 'success' });
      fixture.detectChanges();

      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(
        'todavía no pudimos confirmar la activación',
      );
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');
      expect(mockPostPaymentReturn.clearCheckoutOrigin).toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain(
        'no pudimos verificar la activación por un problema de conexión',
      );
    });

    it('does not trust an initially Premium local token when callback refreshes fail', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      isPremiumSignal.set(true);
      mockAuthService.refresh.mockReturnValue(throwError(() => new Error('refresh unavailable')));

      fixture.detectChanges();
      queryParamsSubject.next({ status: 'approved' });
      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(6);
      expect(mockPostPaymentReturn.redirectAfterConfirmedPayment).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');
      expect(fixture.nativeElement.textContent).toContain(
        'no pudimos verificar la activación por un problema de conexión',
      );
      errorSpy.mockRestore();
    });

    it('does not trust an initially Premium local token when refreshed auth returns Basic', () => {
      isPremiumSignal.set(true);
      mockAuthService.refresh.mockImplementation(() => {
        isPremiumSignal.set(false);
        return of({ accessToken: 'basic-token' });
      });

      fixture.detectChanges();
      queryParamsSubject.next({ status: 'approved' });
      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(6);
      expect(mockPostPaymentReturn.redirectAfterConfirmedPayment).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain('Tu suscripción ya está activa');
      expect(fixture.nativeElement.textContent).toContain('todavía no pudimos confirmar la activación');
    });

    it('keeps polling when individual refresh requests fail', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.refresh
        .mockImplementationOnce(() => throwError(() => new Error('network error')))
        .mockImplementationOnce(() => throwError(() => new Error('network error')))
        .mockImplementation(() => {
          refreshCallCount++;
          isPremiumSignal.set(true);
          return of({ accessToken: `recovered-token-${refreshCallCount}` });
        });

      fixture.detectChanges();
      queryParamsSubject.next({ status: 'success' });
      fixture.detectChanges();

      expect(mockAuthService.refresh).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1500);
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1500);
      expect(mockAuthService.refresh).toHaveBeenCalledTimes(3);
      expect(mockAuthService.isPremium()).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith('[PerfilComponent.paymentRefresh Error]', {
        reason: 'request-failed',
      });

      errorSpy.mockRestore();
    });

    it('does not repeat an announcement after a consumed payment status on a new profile instance', () => {
      fixture.detectChanges();
      queryParamsSubject.next({ status: 'pending' });
      fixture.destroy();

      const reloadedFixture = TestBed.createComponent(PerfilComponent);
      reloadedFixture.detectChanges();

      expect(reloadedFixture.nativeElement.textContent).not.toContain('Todavía no confirmamos el pago');
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
      reloadedFixture.destroy();
    });
  });
});

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
