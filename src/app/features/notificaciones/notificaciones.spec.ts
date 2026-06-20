import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Notificaciones } from './notificaciones';
import { NotificacionesApiService } from './services/notificaciones-api.service';
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
    mockApi = {
      getNotificaciones: vi.fn().mockReturnValue(of([
        { id: '1', usuarioId: 'u1', tipo: 'asignacion_tarea', mensaje: 'Javier Recchia te asignó la tarea "Limpiar los vidrios"', leida: false, referenciaId: 't1', referenciaTipo: 'tarea', createdAt: '2026-06-15T18:00:00Z' }
      ])),
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

  it('verTarea() marks notification as read if unread and navigates with queryParams', () => {
    const notif = { id: '1', usuarioId: 'u1', tipo: 'asignacion_tarea', mensaje: 'Javier Recchia te asignó la tarea "Limpiar los vidrios"', leida: false, referenciaId: 't1', referenciaTipo: 'tarea', createdAt: '2026-06-15T18:00:00Z' };
    
    component['verTarea'](notif);

    expect(mockApi.marcarComoLeida).toHaveBeenCalledWith('1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/tareas'], { queryParams: { taskId: 't1' } });
  });
});
