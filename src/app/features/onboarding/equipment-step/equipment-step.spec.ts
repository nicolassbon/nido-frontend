import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EquipmentStep } from './equipment-step';
import { ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';
import { OnboardingApiService } from '../onboarding-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

describe('EquipmentStep', () => {
  let mockElectrodomesticos: {
    getCatalogo: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let mockOnboardingApi: {
    saveEquipmentStep: ReturnType<typeof vi.fn>;
  };
  let mockAuth: {
    getUserId: ReturnType<typeof vi.fn>;
    getHogarId: ReturnType<typeof vi.fn>;
  };

  const catalogo = [
    { id: 'c1', nombre: 'Heladera', tipo: 'frio', icono: 'refrigerator', imagenUrl: null, orden: 1 },
    { id: 'c2', nombre: 'Microondas', tipo: 'coccion', icono: 'microwave', imagenUrl: null, orden: 2 },
  ];

  beforeEach(async () => {
    mockElectrodomesticos = {
      getCatalogo: vi.fn().mockReturnValue(of(catalogo)),
      getAll: vi.fn().mockReturnValue(of([
        { id: 'e1', hogarId: 'h1', nombre: 'Heladera', tipo: 'frio', estado: 'activo', imagenUrl: null, marca: null, catalogoId: 'c1' },
      ])),
    };

    mockOnboardingApi = {
      saveEquipmentStep: vi.fn().mockReturnValue(of(undefined)),
    };

    mockAuth = {
      getUserId: vi.fn().mockReturnValue('u1'),
      getHogarId: vi.fn().mockReturnValue('h1'),
    };

    await TestBed.configureTestingModule({
      imports: [EquipmentStep],
      providers: [
        ...appConfig.providers,
        { provide: ElectrodomesticosService, useValue: mockElectrodomesticos },
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ngOnInit() carga catálogo y preselecciona equipamiento guardado', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.catalogo()).toEqual(catalogo);
    expect(comp.isSelected('c1')).toBe(true);
    expect(comp.isSelected('c2')).toBe(false);
    expect(comp.loading()).toBe(false);
  });

  it('toggle() selecciona y deselecciona ítems', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    const comp = fixture.componentInstance;

    comp.toggle('c2');
    expect(comp.isSelected('c2')).toBe(true);

    comp.toggle('c2');
    expect(comp.isSelected('c2')).toBe(false);
  });

  it('confirmLeave() cierra el modal y redirige a /', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.showLeaveModal.set(true);

    comp.confirmLeave();

    expect(comp.showLeaveModal()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('back() navega a /crear-hogar', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp.back();

    expect(navigateSpy).toHaveBeenCalledWith(['/crear-hogar']);
  });

  it('next() guarda el equipamiento seleccionado y navega a /finalizar-hogar', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp.toggle('c2');
    comp.next();

    expect(mockOnboardingApi.saveEquipmentStep).toHaveBeenCalledWith({
      skip: false,
      usuarioId: 'u1',
      hogarId: 'h1',
      equipments: [
        { catalogoId: 'c1', nombre: 'Heladera', tipo: 'frio', estado: 'activo' },
        { catalogoId: 'c2', nombre: 'Microondas', tipo: 'coccion', estado: 'activo' },
      ],
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/finalizar-hogar']);
  });

  it('skip() envía skip=true y navega a /finalizar-hogar', () => {
    const fixture = TestBed.createComponent(EquipmentStep);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.skip();

    expect(mockOnboardingApi.saveEquipmentStep).toHaveBeenCalledWith({
      skip: true,
      usuarioId: 'u1',
      hogarId: 'h1',
      equipments: [],
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/finalizar-hogar']);
  });

  it('next() muestra error si falla el guardado', () => {
    mockOnboardingApi.saveEquipmentStep.mockReturnValue(throwError(() => new Error('fail')));
    const fixture = TestBed.createComponent(EquipmentStep);
    fixture.detectChanges();

    fixture.componentInstance.next();

    expect(fixture.componentInstance.error()).toBe('No pudimos guardar el equipamiento.');
    expect(fixture.componentInstance.saving()).toBe(false);
  });
});
