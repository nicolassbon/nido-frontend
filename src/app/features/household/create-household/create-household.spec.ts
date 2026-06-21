import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CreateHousehold } from './create-household';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';
import { OnboardingApiService } from '../../onboarding/onboarding-api.service';
import { HogaresApiService } from '../hogares-api.service';

describe('CreateHousehold', () => {
  let fixture: ComponentFixture<CreateHousehold>;
  let mockOnboardingApi: {
    saveHouseholdStep: ReturnType<typeof vi.fn>;
  };
  let mockHogaresApi: {
    getMiembros: ReturnType<typeof vi.fn>;
    invitar: ReturnType<typeof vi.fn>;
    removeMiembro: ReturnType<typeof vi.fn>;
  };
  let mockAuth: {
    getUserId: ReturnType<typeof vi.fn>;
    getHogarId: ReturnType<typeof vi.fn>;
    getNombre: ReturnType<typeof vi.fn>;
  };

  afterEach(() => {
    fixture?.destroy();
  });

  beforeEach(async () => {
    mockOnboardingApi = {
      saveHouseholdStep: vi.fn().mockReturnValue(of(undefined)),
    };
    mockHogaresApi = {
      getMiembros: vi.fn().mockReturnValue(of([])),
      invitar: vi.fn().mockReturnValue(of({ token: 'inv-tok' })),
      removeMiembro: vi.fn().mockReturnValue(of(undefined)),
    };
    mockAuth = {
      getUserId: vi.fn().mockReturnValue('u1'),
      getHogarId: vi.fn().mockReturnValue('h1'),
      getNombre: vi.fn().mockReturnValue('Nico'),
    };

    await TestBed.configureTestingModule({
      imports: [CreateHousehold],
      providers: [
        ...appConfig.providers,
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sortedMembers pone al usuario actual primero', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const sorted = fixture.componentInstance.sortedMembers();
    expect(sorted[0].isCurrentUser).toBe(true);
  });

  it('inicializa el miembro actual desde el token', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    fixture.detectChanges();
    const members = fixture.componentInstance.members();

    expect(members).toHaveLength(1);
    expect(members[0].id).toBe('u1');
    expect(members[0].name).toBe('Nico');
    expect(members[0].isCurrentUser).toBe(true);
  });

  it('polling reemplaza miembros y conserva foto del usuario actual', () => {
    mockHogaresApi.getMiembros.mockReturnValue(of([
      { usuarioId: 'u1', nombre: 'Nico', email: 'nico@test.com', rol: 'owner', fotoUrl: 'https://img.test/nico.webp' },
      { usuarioId: 'u2', nombre: 'Abi', email: 'abi@test.com', rol: 'member', fotoUrl: null },
    ]));

    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(CreateHousehold);
      fixture.detectChanges();
      vi.advanceTimersByTime(1);

      const current = fixture.componentInstance.members()[0];
      expect(current.name).toBe('Nico');
      expect(current.fotoUrl).toBe('https://img.test/nico.webp');
      expect(current.isCurrentUser).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removeMember() elimina al miembro aceptado y cierra el menú', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.members.set([
      { id: 'u1', name: 'Nico', role: 'Tú', color: '#263F30', initials: 'N', isCurrentUser: true },
      { id: 'u2', name: 'Abi', role: 'member', color: '#C78F5A', initials: 'A' },
    ]);
    const initialCount = comp.members().length;
    const idToRemove = comp.members().find(m => !m.isCurrentUser)!.id;
    comp.openMenuId.set(idToRemove);

    comp.removeMember(idToRemove);

    expect(comp.members()).toHaveLength(initialCount - 1);
    expect(comp.members().find(m => m.id === idToRemove)).toBeUndefined();
    expect(comp.openMenuId()).toBeNull();
  });

  it('addMember() abre el modal con email y estado en blanco', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('anterior@email.com');
    comp.inviteState.set('error');
    comp.inviteErrorMsg.set('Error');

    comp.addMember();

    expect(comp.showInviteModal()).toBe(true);
    expect(comp.inviteEmail()).toBe('');
    expect(comp.inviteState()).toBe('idle');
    expect(comp.inviteErrorMsg()).toBe('');
  });

  it('closeInviteModal() oculta el modal', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.showInviteModal.set(true);

    comp.closeInviteModal();

    expect(comp.showInviteModal()).toBe(false);
  });

  it('submitInvite() llama a la API y establece estado success', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('nuevo@test.com');

    comp.submitInvite();

    expect(mockHogaresApi.invitar).toHaveBeenCalledWith('nuevo@test.com');
    expect(comp.inviteState()).toBe('success');
  });

  it('submitInvite() no llama a la API con email vacío', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('   ');

    comp.submitInvite();

    expect(mockHogaresApi.invitar).not.toHaveBeenCalled();
  });

  it('submitInvite() establece estado error con mensaje del servidor', () => {
    mockHogaresApi.invitar.mockReturnValue(throwError(() => ({ error: { message: 'Email no encontrado' } })));
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('desconocido@test.com');

    comp.submitInvite();

    expect(comp.inviteState()).toBe('error');
    expect(comp.inviteErrorMsg()).toBe('Email no encontrado');
  });

  it('toggleMenu() abre el menú del miembro y llama stopPropagation', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    const fakeEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    comp.toggleMenu('m1', fakeEvent);

    expect(comp.openMenuId()).toBe('m1');
    expect(fakeEvent.stopPropagation).toHaveBeenCalled();
  });

  it('toggleMenu() cierra el menú si ya estaba abierto', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    const fakeEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    comp.toggleMenu('m1', fakeEvent);
    comp.toggleMenu('m1', fakeEvent);

    expect(comp.openMenuId()).toBeNull();
  });

  it('closeMenus() limpia openMenuId', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.openMenuId.set('alguno');

    comp.closeMenus();

    expect(comp.openMenuId()).toBeNull();
  });

  it('next() marca step-2 completo sin miembros representados y navega a /equipamiento', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    comp.next();

    expect(mockOnboardingApi.saveHouseholdStep).toHaveBeenCalledWith({
      skip: false,
      usuarioId: 'u1',
      hogarId: 'h1',
      members: [],
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/equipamiento']);
  });

  it('skip() guarda step-2 como omitido y navega a /equipamiento', () => {
    fixture = TestBed.createComponent(CreateHousehold);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.skip();

    expect(mockOnboardingApi.saveHouseholdStep).toHaveBeenCalledWith({
      skip: true,
      usuarioId: 'u1',
      hogarId: 'h1',
      members: [],
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/equipamiento']);
  });

  it('next() muestra error si no puede guardar step-2', () => {
    mockOnboardingApi.saveHouseholdStep.mockReturnValue(throwError(() => new Error('fail')));
    fixture = TestBed.createComponent(CreateHousehold);

    fixture.componentInstance.next();

    expect(fixture.componentInstance.saveErrorMsg()).toBe('No pudimos guardar los datos de tu hogar. Intentá de nuevo.');
  });

  describe('stepCircleClass()', () => {
    it('retorna clase rellena para el paso activo', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: false, active: true });
      expect(result).toContain('bg-nido-cream');
    });

    it('retorna clase rellena para el paso completado', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: true, active: false });
      expect(result).toContain('bg-nido-cream');
    });

    it('retorna clase con borde para el paso inactivo', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: false, active: false });
      expect(result).toContain('border-[rgba(247,241,230,0.35)]');
    });
  });

  describe('stepLabelClass()', () => {
    it('retorna clase semibold para el paso activo', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      expect(fixture.componentInstance.stepLabelClass({ active: true })).toContain('font-semibold');
    });

    it('retorna clase con opacidad reducida para el paso inactivo', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      expect(fixture.componentInstance.stepLabelClass({ active: false })).toContain('0.45');
    });
  });

  describe('interacción con logo y modal de salida', () => {
    it('onLogoClick() abre el modal y frena propagación', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const comp = fixture.componentInstance;
      const fakeEvent = { stopPropagation: vi.fn() } as unknown as Event;

      comp.onLogoClick(fakeEvent);

      expect(comp.showLeaveModal()).toBe(true);
      expect(fakeEvent.stopPropagation).toHaveBeenCalled();
    });

    it('closeLeaveModal() cierra el modal', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const comp = fixture.componentInstance;
      comp.showLeaveModal.set(true);

      comp.closeLeaveModal();

      expect(comp.showLeaveModal()).toBe(false);
    });

    it('confirmLeave() cierra el modal y redirige a /', () => {
      fixture = TestBed.createComponent(CreateHousehold);
      const comp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      comp.showLeaveModal.set(true);

      comp.confirmLeave();

      expect(comp.showLeaveModal()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });
  });
});
