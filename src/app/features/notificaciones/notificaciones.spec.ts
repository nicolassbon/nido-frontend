import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Notificaciones } from './notificaciones';
import { NotificacionesApiService, NotificacionResponse } from './services/notificaciones-api.service';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';
import { Router } from '@angular/router';

describe('Notificaciones Component', () => {
  let component: Notificaciones;
  let fixture: ComponentFixture<Notificaciones>;
  let mockApi: any;
  let mockRouter: any;

  beforeEach(async () => {
    const mockList: NotificacionResponse[] = [
      { id: '1', usuarioId: 'u1', tipo: 'asignacion_tarea', mensaje: 'Javier Recchia te asignó la tarea "Limpiar los vidrios"', leida: false, referenciaId: 't1', referenciaTipo: 'tarea', createdAt: '2026-06-15T18:00:00Z' }
    ];
    mockApi = {
      notificaciones: signal(mockList),
      unreadCount: signal(1),
      getNotificaciones: vi.fn().mockReturnValue(of(mockList)),
      marcarComoLeida: vi.fn().mockReturnValue(of(void 0)),
      marcarTodasComoLeidas: vi.fn().mockReturnValue(of(void 0)),
      eliminarNotificacion: vi.fn().mockReturnValue(of(void 0)),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Notificaciones],
      providers: [
        ...appConfig.providers,
        { provide: NotificacionesApiService, useValue: mockApi },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Notificaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('verRecurso() marks notification as read if unread and navigates with queryParams', () => {
    const notif = { id: '1', usuarioId: 'u1', tipo: 'asignacion_tarea', mensaje: 'Javier Recchia te asignó la tarea "Limpiar los vidrios"', leida: false, referenciaId: 't1', referenciaTipo: 'tarea', createdAt: '2026-06-15T18:00:00Z' };
    
    component['verRecurso'](notif);
 
    expect(mockApi.marcarComoLeida).toHaveBeenCalledWith('1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/tareas'], { queryParams: { taskId: 't1' } });
  });

  it('verRecurso() navigates to alacena product detail if referenciaTipo is alacena', () => {
    const notif = { id: '2', usuarioId: 'u1', tipo: 'stock_bajo', mensaje: 'El stock del producto "Crema de Leche" es bajo', leida: true, referenciaId: 'p1', referenciaTipo: 'alacena', createdAt: '2026-06-15T18:00:00Z' };
    
    component['verRecurso'](notif);
 
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/alacena', 'p1']);
  });
});
