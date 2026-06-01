import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CreateHousehold } from './create-household';
import { HogaresApiService } from '../hogares-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { appConfig } from '../../../app.config';

describe('CreateHousehold', () => {
  let mockApi: {
    getMiembros: ReturnType<typeof vi.fn>;
    invitar: ReturnType<typeof vi.fn>;
    removeMiembro: ReturnType<typeof vi.fn>;
  };
  let mockAuth: { getUserId: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockApi = {
      getMiembros: vi.fn().mockReturnValue(of([])),
      invitar: vi.fn().mockReturnValue(of({ token: 'inv-tok' })),
      removeMiembro: vi.fn().mockReturnValue(of(null)),
    };
    mockAuth = { getUserId: vi.fn().mockReturnValue(null) };

    await TestBed.configureTestingModule({
      imports: [CreateHousehold],
      providers: [
        ...appConfig.providers,
        { provide: HogaresApiService, useValue: mockApi },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sortedMembers pone al usuario actual primero', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const sorted = fixture.componentInstance.sortedMembers();
    expect(sorted[0].isCurrentUser).toBe(true);
  });

  it('ngOnInit() reemplaza los miembros cuando la API devuelve datos', async () => {
    mockApi.getMiembros.mockReturnValue(
      of([
        { usuarioId: 'u1', nombre: 'María', email: 'maria@test.com', rol: 'admin', fotoUrl: null },
        { usuarioId: 'u2', nombre: 'Juan', email: 'juan@test.com', rol: 'miembro', fotoUrl: null },
      ]),
    );
    mockAuth.getUserId.mockReturnValue('u1');

    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(CreateHousehold);
      fixture.detectChanges();

      vi.advanceTimersByTime(1);

      const members = fixture.componentInstance.members();
      expect(members).toHaveLength(2);
      expect(members[0].name).toBe('María');
      expect(members[0].isCurrentUser).toBe(true);
      expect(members[1].isCurrentUser).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ngOnInit() conserva los datos mock cuando la API devuelve lista vacía', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    fixture.detectChanges();
    expect(fixture.componentInstance.members().length).toBeGreaterThan(0);
  });

  it('removeMember() elimina al miembro y cierra el menú', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const initialCount = comp.members().length;
    const idToRemove = comp.members().find(m => !m.isCurrentUser)!.id;
    comp.openMenuId.set(idToRemove);

    comp.removeMember(idToRemove);

    expect(comp.members()).toHaveLength(initialCount - 1);
    expect(comp.members().find(m => m.id === idToRemove)).toBeUndefined();
    expect(comp.openMenuId()).toBeNull();
  });

  it('addMember() abre el modal con email y estado en blanco', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('anterior@email.com');
    comp.inviteState.set('error');

    comp.addMember();

    expect(comp.showInviteModal()).toBe(true);
    expect(comp.inviteEmail()).toBe('');
    expect(comp.inviteState()).toBe('idle');
  });

  it('closeInviteModal() oculta el modal', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.showInviteModal.set(true);

    comp.closeInviteModal();

    expect(comp.showInviteModal()).toBe(false);
  });

  it('submitInvite() llama a la API y establece estado success', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('nuevo@test.com');

    comp.submitInvite();

    expect(mockApi.invitar).toHaveBeenCalledWith('nuevo@test.com');
    expect(comp.inviteState()).toBe('success');
  });

  it('submitInvite() no llama a la API con email vacío', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('   ');

    comp.submitInvite();

    expect(mockApi.invitar).not.toHaveBeenCalled();
  });

  it('submitInvite() establece estado error con mensaje del servidor', () => {
    mockApi.invitar.mockReturnValue(
      throwError(() => ({ error: { message: 'Email no encontrado' } })),
    );
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.inviteEmail.set('desconocido@test.com');

    comp.submitInvite();

    expect(comp.inviteState()).toBe('error');
    expect(comp.inviteErrorMsg()).toBe('Email no encontrado');
  });

  it('toggleMenu() abre el menú del miembro y llama stopPropagation', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    const fakeEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    comp.toggleMenu('m1', fakeEvent);

    expect(comp.openMenuId()).toBe('m1');
    expect(fakeEvent.stopPropagation).toHaveBeenCalled();
  });

  it('toggleMenu() cierra el menú si ya estaba abierto', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    const fakeEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;

    comp.toggleMenu('m1', fakeEvent);
    comp.toggleMenu('m1', fakeEvent);

    expect(comp.openMenuId()).toBeNull();
  });

  it('closeMenus() limpia openMenuId', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const comp = fixture.componentInstance;
    comp.openMenuId.set('alguno');

    comp.closeMenus();

    expect(comp.openMenuId()).toBeNull();
  });

  it('next() navega a /equipamiento y skip() navega a /finalizar-hogar', () => {
    const fixture = TestBed.createComponent(CreateHousehold);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.next();
    expect(navigateSpy).toHaveBeenCalledWith(['/equipamiento']);

    fixture.componentInstance.skip();
    expect(navigateSpy).toHaveBeenCalledWith(['/finalizar-hogar']);
  });

  describe('stepCircleClass()', () => {
    it('retorna clase rellena para el paso activo', () => {
      const fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: false, active: true });
      expect(result).toContain('bg-nido-cream');
    });

    it('retorna clase rellena para el paso completado', () => {
      const fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: true, active: false });
      expect(result).toContain('bg-nido-cream');
    });

    it('retorna clase con borde para el paso inactivo', () => {
      const fixture = TestBed.createComponent(CreateHousehold);
      const result = fixture.componentInstance.stepCircleClass({ completed: false, active: false });
      expect(result).toContain('border-[rgba(247,241,230,0.35)]');
    });
  });

  describe('stepLabelClass()', () => {
    it('retorna clase semibold para el paso activo', () => {
      const fixture = TestBed.createComponent(CreateHousehold);
      expect(fixture.componentInstance.stepLabelClass({ active: true })).toContain('font-semibold');
    });

    it('retorna clase con opacidad reducida para el paso inactivo', () => {
      const fixture = TestBed.createComponent(CreateHousehold);
      expect(fixture.componentInstance.stepLabelClass({ active: false })).toContain('0.45');
    });
  });
});
