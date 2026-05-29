import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AcceptInvitation } from './accept-invitation';
import { HogaresApiService } from '../hogares-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

const makeRoute = (token: string | null) => ({
  snapshot: { queryParamMap: { get: (k: string) => (k === 'token' ? token : null) } },
});

const defaultApiResponse = { hogarId: 'h1', hogarNombre: 'Casa Test', accessToken: 'jwt123' };

describe('AcceptInvitation', () => {
  describe('cuando hay token en la URL', () => {
    let mockApi: { aceptarInvitacion: ReturnType<typeof vi.fn> };
    let mockAuth: { setToken: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      mockApi = { aceptarInvitacion: vi.fn().mockReturnValue(of(defaultApiResponse)) };
      mockAuth = { setToken: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [AcceptInvitation],
        providers: [
          ...appConfig.providers,
          { provide: HogaresApiService, useValue: mockApi },
          { provide: AuthService, useValue: mockAuth },
          { provide: ActivatedRoute, useValue: makeRoute('invite-tok') },
        ],
      }).compileComponents();
    });

    it('should create', () => {
      const fixture = TestBed.createComponent(AcceptInvitation);
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('lee el token de los query params en ngOnInit', () => {
      const fixture = TestBed.createComponent(AcceptInvitation);
      fixture.detectChanges();
      expect(fixture.componentInstance.token()).toBe('invite-tok');
      expect(fixture.componentInstance.state()).toBe('idle');
    });

    it('accept() llama a la API, guarda el token JWT y muestra estado success', async () => {
      const fixture = TestBed.createComponent(AcceptInvitation);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      vi.useFakeTimers();
      try {
        fixture.componentInstance.accept();

        expect(mockApi.aceptarInvitacion).toHaveBeenCalledWith('invite-tok');
        expect(mockAuth.setToken).toHaveBeenCalledWith('jwt123');
        expect(fixture.componentInstance.hogarNombre()).toBe('Casa Test');
        expect(fixture.componentInstance.state()).toBe('success');

        await vi.advanceTimersByTimeAsync(2500);
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('accept() muestra el estado error con el mensaje del servidor', () => {
      mockApi.aceptarInvitacion.mockReturnValue(
        throwError(() => ({ error: { message: 'Token expirado' } })),
      );
      const fixture = TestBed.createComponent(AcceptInvitation);
      fixture.detectChanges();

      fixture.componentInstance.accept();

      expect(fixture.componentInstance.state()).toBe('error');
      expect(fixture.componentInstance.errorMsg()).toBe('Token expirado');
    });

    it('accept() usa mensaje de error por defecto cuando el servidor no provee uno', () => {
      mockApi.aceptarInvitacion.mockReturnValue(throwError(() => ({})));
      const fixture = TestBed.createComponent(AcceptInvitation);
      fixture.detectChanges();

      fixture.componentInstance.accept();

      expect(fixture.componentInstance.state()).toBe('error');
      expect(fixture.componentInstance.errorMsg()).toBe('La invitación no es válida o ya expiró.');
    });

    it('goHome() navega a /', () => {
      const fixture = TestBed.createComponent(AcceptInvitation);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.goHome();

      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });
  });

  describe('cuando no hay token en la URL', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AcceptInvitation],
        providers: [
          ...appConfig.providers,
          { provide: HogaresApiService, useValue: { aceptarInvitacion: vi.fn() } },
          { provide: AuthService, useValue: { setToken: vi.fn() } },
          { provide: ActivatedRoute, useValue: makeRoute(null) },
        ],
      }).compileComponents();
    });

    it('establece state en invalid y token en null', () => {
      const fixture = TestBed.createComponent(AcceptInvitation);
      fixture.detectChanges();
      expect(fixture.componentInstance.state()).toBe('invalid');
      expect(fixture.componentInstance.token()).toBeNull();
    });
  });
});
