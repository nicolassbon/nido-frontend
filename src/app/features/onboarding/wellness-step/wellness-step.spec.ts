import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WellnessStep } from './wellness-step';
import { OnboardingApiService } from '../onboarding-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

describe('WellnessStep', () => {
  let mockApi: {
    getPreferenciasAlimentarias: ReturnType<typeof vi.fn>;
    getAlergias: ReturnType<typeof vi.fn>;
    getMetas: ReturnType<typeof vi.fn>;
    saveWellnessStep: ReturnType<typeof vi.fn>;
    getWellness: ReturnType<typeof vi.fn>;
  };
  let mockAuth: {
    getUserId: ReturnType<typeof vi.fn>;
    getHogarId: ReturnType<typeof vi.fn>;
  };

  const mockPreferencias = [
    { id: 'p1', nombre: 'Vegano', tipo: 'preferencia' },
    { id: 'p2', nombre: 'Sin TACC', tipo: 'preferencia' },
  ];
  const mockAlergias = [
    { id: 'a1', nombre: 'Maní', tipo: 'alergia' },
    { id: 'a2', nombre: 'Gluten', tipo: 'alergia' },
  ];
  const mockMetas = [
    { id: 'm1', nombre: 'Ahorro' },
    { id: 'm2', nombre: 'Mejor organización' },
  ];

  beforeEach(async () => {
    localStorage.clear();

    mockApi = {
      getPreferenciasAlimentarias: vi.fn().mockReturnValue(of(mockPreferencias)),
      getAlergias: vi.fn().mockReturnValue(of(mockAlergias)),
      getMetas: vi.fn().mockReturnValue(of(mockMetas)),
      saveWellnessStep: vi.fn().mockReturnValue(of(undefined)),
      getWellness: vi.fn().mockReturnValue(of({ restriccionIds: [], metaIds: [] })),
    };
    mockAuth = {
      getUserId: vi.fn().mockReturnValue('u1'),
      getHogarId: vi.fn().mockReturnValue('h1'),
    };

    await TestBed.configureTestingModule({
      imports: [WellnessStep],
      providers: [
        ...appConfig.providers,
        { provide: OnboardingApiService, useValue: mockApi },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WellnessStep);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ngOnInit() carga los tres catálogos desde la API', () => {
    const fixture = TestBed.createComponent(WellnessStep);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.preferencias()).toEqual(mockPreferencias);
    expect(comp.allAlergias()).toEqual(mockAlergias);
    expect(comp.metas()).toEqual(mockMetas);
  });

  describe('preferencias alimentarias', () => {
    it('togglePreferencia() selecciona una preferencia', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      fixture.componentInstance.togglePreferencia('p1');
      expect(fixture.componentInstance.isPreferenciaSelected('p1')).toBe(true);
    });

    it('togglePreferencia() deselecciona una preferencia ya seleccionada', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.togglePreferencia('p1');
      comp.togglePreferencia('p1');
      expect(comp.isPreferenciaSelected('p1')).toBe(false);
    });

    it('isPreferenciaSelected() devuelve false para IDs no seleccionados', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      expect(fixture.componentInstance.isPreferenciaSelected('no-existe')).toBe(false);
    });
  });

  describe('alergias', () => {
    it('addAlergia() agrega a la lista seleccionada y limpia el buscador', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.alergiaSearch.set('man');

      comp.addAlergia({ id: 'a1', nombre: 'Maní', tipo: 'alergia' });

      expect(comp.selectedAlergias()).toHaveLength(1);
      expect(comp.selectedAlergias()[0].id).toBe('a1');
      expect(comp.alergiaSearch()).toBe('');
    });

    it('removeAlergia() elimina la alergia indicada de la selección', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.addAlergia({ id: 'a1', nombre: 'Maní', tipo: 'alergia' });
      comp.addAlergia({ id: 'a2', nombre: 'Gluten', tipo: 'alergia' });

      comp.removeAlergia('a1');

      expect(comp.selectedAlergias()).toHaveLength(1);
      expect(comp.selectedAlergias()[0].id).toBe('a2');
    });

    it('alergiaResults excluye las alergias ya seleccionadas', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.addAlergia({ id: 'a1', nombre: 'Maní', tipo: 'alergia' });

      const results = comp.alergiaResults();
      expect(results.find(a => a.id === 'a1')).toBeUndefined();
      expect(results.find(a => a.id === 'a2')).toBeDefined();
    });

    it('alergiaResults filtra por el término de búsqueda', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.alergiaSearch.set('man');

      const results = comp.alergiaResults();
      expect(results).toHaveLength(1);
      expect(results[0].nombre).toBe('Maní');
    });

    it('showAlergiaDropdown es true cuando está enfocado y hay resultados', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.alergiaInputFocused.set(true);

      expect(comp.showAlergiaDropdown()).toBe(true);
    });

    it('showAlergiaDropdown es false cuando no está enfocado', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      fixture.detectChanges();
      comp.alergiaInputFocused.set(false);

      expect(comp.showAlergiaDropdown()).toBe(false);
    });

    it('onAlergiaBlur() pone focused en false después de 150ms', async () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.alergiaInputFocused.set(true);

      vi.useFakeTimers();
      try {
        comp.onAlergiaBlur();
        expect(comp.alergiaInputFocused()).toBe(true);

        await vi.advanceTimersByTimeAsync(150);
        expect(comp.alergiaInputFocused()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('metas', () => {
    it('toggleMeta() selecciona una meta no seleccionada', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      fixture.componentInstance.toggleMeta('m1');
      expect(fixture.componentInstance.isMetaSelected('m1')).toBe(true);
    });

    it('toggleMeta() deselecciona una meta ya seleccionada', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.toggleMeta('m1');
      comp.toggleMeta('m1');
      expect(comp.isMetaSelected('m1')).toBe(false);
    });
  });

  describe('helpers de íconos', () => {
    it('getPrefIcon() devuelve el ícono correcto para nombres conocidos', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      expect(comp.getPrefIcon('Vegano')).toBe('sprout');
      expect(comp.getPrefIcon('Vegetariano')).toBe('leaf');
      expect(comp.getPrefIcon('Sin TACC')).toBe('wheat-off');
      expect(comp.getPrefIcon('Sin lactosa')).toBe('milk-off');
    });

    it('getPrefIcon() cae al fallback "leaf" para nombres desconocidos', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      expect(fixture.componentInstance.getPrefIcon('Otro')).toBe('leaf');
    });

    it('getMetaIcon() devuelve el ícono correcto para nombres conocidos', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      expect(comp.getMetaIcon('Ahorro')).toBe('trending-up');
      expect(comp.getMetaIcon('Mejor organización')).toBe('clipboard-list');
    });

    it('getMetaIcon() cae al fallback "star" para nombres desconocidos', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      expect(fixture.componentInstance.getMetaIcon('Otro')).toBe('star');
    });
  });

  describe('next()', () => {
    it('guarda las selecciones y navega a /inicio', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.togglePreferencia('p1');
      comp.addAlergia({ id: 'a1', nombre: 'Maní', tipo: 'alergia' });
      comp.toggleMeta('m1');

      comp.next();

      expect(mockApi.saveWellnessStep).toHaveBeenCalledWith({
        skip: false,
        usuarioId: 'u1',
        hogarId: 'h1',
        restriccionIds: expect.arrayContaining(['p1', 'a1']),
        metaIds: ['m1'],
      });
      expect(navigateSpy).toHaveBeenCalledWith(['/inicio']);
    });

    it('establece saveState en error cuando la API falla', () => {
      mockApi.saveWellnessStep.mockReturnValue(throwError(() => new Error('fail')));
      const fixture = TestBed.createComponent(WellnessStep);

      fixture.componentInstance.next();

      expect(fixture.componentInstance.saveState()).toBe('error');
    });

    it('no llama a la API si saveState ya es "saving"', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      fixture.componentInstance.saveState.set('saving');

      fixture.componentInstance.next();

      expect(mockApi.saveWellnessStep).not.toHaveBeenCalled();
    });
  });

  describe('skip()', () => {
    it('llama a saveWellnessStep con skip=true y navega a /inicio', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.skip();

      expect(mockApi.saveWellnessStep).toHaveBeenCalledWith({
        skip: true,
        usuarioId: 'u1',
        hogarId: 'h1',
        restriccionIds: [],
        metaIds: [],
      });
      expect(navigateSpy).toHaveBeenCalledWith(['/inicio']);
    });

    it('navega a /inicio incluso si la API falla', () => {
      mockApi.saveWellnessStep.mockReturnValue(throwError(() => new Error('fail')));
      const fixture = TestBed.createComponent(WellnessStep);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance.skip();

      expect(navigateSpy).toHaveBeenCalledWith(['/inicio']);
    });
  });

  describe('interacción con logo, modal de salida y botón atrás', () => {
    it('onLogoClick() abre el modal y frena propagación', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      const fakeEvent = { stopPropagation: vi.fn() } as unknown as Event;

      comp.onLogoClick(fakeEvent);

      expect(comp.showLeaveModal()).toBe(true);
      expect(fakeEvent.stopPropagation).toHaveBeenCalled();
    });

    it('closeLeaveModal() cierra el modal', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      comp.showLeaveModal.set(true);

      comp.closeLeaveModal();

      expect(comp.showLeaveModal()).toBe(false);
    });

    it('confirmLeave() cierra el modal y redirige a /', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      comp.showLeaveModal.set(true);

      comp.confirmLeave();

      expect(comp.showLeaveModal()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('back() navega a /equipamiento', () => {
      const fixture = TestBed.createComponent(WellnessStep);
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      comp.back();

      expect(navigateSpy).toHaveBeenCalledWith(['/equipamiento']);
    });
  });

  describe('precarga de selecciones anteriores', () => {
    it('ngOnInit() carga y preselecciona restricciones y metas ya guardadas', () => {
      mockApi.getWellness.mockReturnValue(of({
        restriccionIds: ['p1', 'a1'],
        metaIds: ['m2']
      }));

      const fixture = TestBed.createComponent(WellnessStep);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      expect(comp.isPreferenciaSelected('p1')).toBe(true);
      expect(comp.isPreferenciaSelected('p2')).toBe(false);
      expect(comp.selectedAlergias()).toHaveLength(1);
      expect(comp.selectedAlergias()[0].id).toBe('a1');
      expect(comp.isMetaSelected('m2')).toBe(true);
      expect(comp.isMetaSelected('m1')).toBe(false);
    });

    it('ngOnInit() mantiene los catálogos utilizables si falla getWellness()', () => {
      mockApi.getWellness.mockReturnValue(throwError(() => new Error('fail')));

      const fixture = TestBed.createComponent(WellnessStep);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      expect(comp.preferencias()).toEqual(mockPreferencias);
      expect(comp.allAlergias()).toEqual(mockAlergias);
      expect(comp.metas()).toEqual(mockMetas);
      expect(comp.selectedAlergias()).toEqual([]);
      expect(comp.selectedPreferenciaIds().size).toBe(0);
      expect(comp.selectedMetaIds().size).toBe(0);
    });
  });
});
