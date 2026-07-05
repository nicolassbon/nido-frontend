import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { AuthService } from '../../core/auth/auth.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { TareasApiService, type GamificacionProgresoResponse } from './services/tareas-api.service';
import { Tareas } from './tareas';

const progress = (overrides: Partial<GamificacionProgresoResponse> = {}): GamificacionProgresoResponse => ({
  usuarioId: 'user-1',
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

describe('Tareas Component - Behavior Tests', () => {
  let component: Tareas;
  let fixture: ComponentFixture<Tareas>;
  let mockTareasApi: any;
  let mockHogaresApi: any;
  let mockAuthService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockTareasApi = {
      getMisTareas: vi.fn().mockReturnValue(of([])),
      getTareas: vi.fn().mockReturnValue(of([])),
      getDistribucionSemanal: vi.fn().mockReturnValue(of({ dias: [] })),
      getProgreso: vi.fn().mockReturnValue(of(progress())),
      completarTarea: vi.fn().mockReturnValue(of({ id: 't-1', xpOtorgado: 30 })),
      deleteTarea: vi.fn().mockReturnValue(of(undefined)),
      asignarTarea: vi.fn().mockReturnValue(of({ id: 't-1' })),
    };

    mockHogaresApi = {
      getMiembros: vi.fn().mockReturnValue(of([])),
    };

    mockAuthService = {
      getUserId: vi.fn().mockReturnValue('user-1'),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Tareas],
      providers: [
        ...appConfig.providers,
        { provide: TareasApiService, useValue: mockTareasApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Tareas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('backend-driven progress', () => {
    it('calculates progress percentage from backend current XP and next threshold', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 120, nextThresholdXp: 240, xpToNextLevel: 120 })));

      component['cargarDatos']();

      expect(component['nivel']()).toBe(2);
      expect(component['xp']()).toBe(120);
      expect(component['xpEnNivelActual']()).toBe(120);
      expect(component['xpNecesariaParaSiguienteNivel']()).toBe(240);
      expect(component['xpSiguienteNivelTotal']()).toBe(240);
      expect(component['porcentajeXp']()).toBe(50);
    });

    it('does not use frontend hardcoded thresholds when backend sends different values', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 2, currentXp: 30, nextThresholdXp: 60, xpToNextLevel: 30 })));

      component['cargarDatos']();

      expect(component['xpSiguienteNivelTotal']()).toBe(60);
      expect(component['porcentajeXp']()).toBe(50);
    });

    it('uses backend hasNextLevel to render max-level progress', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({
        currentXp: 500,
        currentLevel: 5,
        nextLevel: null,
        nextLevelNombre: null,
        nextThresholdXp: null,
        xpToNextLevel: 0,
        hasNextLevel: false,
      })));

      component['cargarDatos']();

      expect(component['nivel']()).toBe(5);
      expect(component['porcentajeXp']()).toBe(100);
      expect(component['xpNecesariaParaSiguienteNivel']()).toBe(0);
    });

    it('keeps level 0 as returned by backend while using local level-1 avatar asset', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 0, currentXp: 0, nextThresholdXp: 20, xpToNextLevel: 20 })));

      component['cargarDatos']();

      expect(component['nivel']()).toBe(0);
      expect(component['imagenNivel']()).toBe(1);
    });
  });

  describe('completarTarea completion flows and timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows granted XP only when backend returns xpOtorgado', () => {
      mockTareasApi.completarTarea.mockReturnValue(of({ id: 't-1', xpOtorgado: 30 }));
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 150 })));

      component['completarTarea']({ id: 't-1', titulo: 'Test' } as any);

      expect(component['floatingXPs']()).toHaveLength(1);
      expect(component['floatingXPs']()[0].value).toBe('+30 XP');

      vi.advanceTimersByTime(1500);
      expect(component['floatingXPs']()).toHaveLength(0);
    });

    it('does not invent a fallback XP animation when backend omits xpOtorgado', () => {
      mockTareasApi.completarTarea.mockReturnValue(of({ id: 't-1' }));
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 150 })));

      component['completarTarea']({ id: 't-1', titulo: 'Test' } as any);

      expect(component['floatingXPs']()).toHaveLength(0);
    });

    it('handles task completion with level-up and celebration timers', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentLevel: 2, currentXp: 120 })));
      component['cargarDatos']();
      expect(component['nivel']()).toBe(2);

      mockTareasApi.completarTarea.mockReturnValue(of({ id: 't-1', xpOtorgado: 80 }));
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 200, currentLevel: 3 })));

      component['completarTarea']({ id: 't-1', titulo: 'Test' } as any);

      expect(component['nivel']()).toBe(3);
      expect(component['xp']()).toBe(200);
      expect(component['evolucionando']()).toBe(true);
      expect(component['mostrarCelebracionLevelUp']()).toBe(false);

      vi.advanceTimersByTime(2000);
      expect(component['evolucionando']()).toBe(false);
      expect(component['nivelCelebrado']()).toBe(3);
      expect(component['mostrarCelebracionLevelUp']()).toBe(true);
    });
  });

  describe('DOM rendering of backend progress contract', () => {
    it('renders total XP and backend next threshold', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 120, nextThresholdXp: 240, xpToNextLevel: 120 })));
      component['cargarDatos']();
      fixture.detectChanges();

      const element: HTMLElement = fixture.nativeElement;
      const totalXpText = element.querySelector('.xp-total-text')?.textContent?.trim();
      const progressText = element.querySelector('.xp-bar-text')?.textContent?.trim();

      expect(totalXpText).toBe('120 XP total');
      expect(progressText).toBe('120 / 240 XP');
    });

    it('does not render invented XP for completed tasks without xpOtorgado', () => {
      mockTareasApi.getTareas.mockReturnValue(of([
        {
          id: 't-1',
          titulo: 'Completed task',
          estado: 'completada',
          fechaCompletado: '2026-07-05T10:00:00.000Z',
          xpOtorgado: null,
        },
      ]));
      component['cargarDatos']();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain('+20 XP');
    });

    it('renders maximum level text when backend reports no next level', () => {
      mockTareasApi.getProgreso.mockReturnValue(of(progress({
        currentXp: 400,
        currentLevel: 5,
        nextLevel: null,
        nextLevelNombre: null,
        nextThresholdXp: null,
        xpToNextLevel: 0,
        hasNextLevel: false,
      })));
      component['cargarDatos']();
      fixture.detectChanges();

      const element: HTMLElement = fixture.nativeElement;
      const progressText = element.querySelector('.xp-bar-text')?.textContent?.trim();

      expect(progressText).toBe('Nivel Máximo Alcanzado');
    });
  });

  describe('error handling and timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('logs console.error and shows banner on completarTarea failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTareasApi.completarTarea.mockReturnValue(throwError(() => new Error('API Error')));

      component['completarTarea']({ id: 't-1', titulo: 'Test' } as any);

      expect(errSpy).toHaveBeenCalled();
      expect(component['errorMsg']()).toBe('No pudimos registrar la tarea como completada.');

      vi.advanceTimersByTime(5000);
      expect(component['errorMsg']()).toBeNull();

      errSpy.mockRestore();
    });

    it('logs console.error on cargarDatos progress failure', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTareasApi.getProgreso.mockReturnValue(throwError(() => new Error('API Error')));

      component['cargarDatos']();

      expect(errSpy).toHaveBeenCalled();
      expect(component['errorMsg']()).toBe('No pudimos cargar tu progreso y nivel.');

      errSpy.mockRestore();
    });

    it('clears all active timeouts when destroyed', () => {
      const spyClear = vi.spyOn(globalThis, 'clearTimeout');

      mockTareasApi.completarTarea.mockReturnValue(of({ id: 't-1', xpOtorgado: 30 }));
      mockTareasApi.getProgreso.mockReturnValue(of(progress({ currentXp: 150 })));
      component['completarTarea']({ id: 't-1', titulo: 'Test' } as any);

      component['showError']('Test error');

      expect(component['floatingXPTimers']).toHaveLength(1);
      expect(component['errorTimeoutId']).not.toBeNull();

      fixture.destroy();

      expect(spyClear).toHaveBeenCalled();
      expect(component['floatingXPTimers']).toHaveLength(0);

      spyClear.mockRestore();
    });
  });
});
