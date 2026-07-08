import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { HogaresApiService } from '../household/hogares-api.service';
import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import { TareasApiService, type GamificacionProgresoResponse } from '../tareas/services/tareas-api.service';
import { PerfilApiService } from './perfil-api.service';
import { PerfilComponent } from './perfil';

const progress = (overrides: Partial<GamificacionProgresoResponse> = {}): GamificacionProgresoResponse => ({
  usuarioId: 'u-1',
  currentXp: 120,
  currentLevel: 2,
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

  beforeEach(async () => {
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

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        ...appConfig.providers,
        { provide: PerfilApiService, useValue: mockPerfilApi },
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
        { provide: TareasApiService, useValue: mockTareasApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
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
});
