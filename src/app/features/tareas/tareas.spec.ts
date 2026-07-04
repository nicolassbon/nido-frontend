import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Tareas } from './tareas';
import { TareasApiService, TareaResponse } from './services/tareas-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { appConfig } from '../../app.config';

function makeTarea(overrides: Partial<TareaResponse> = {}): TareaResponse {
  return {
    id: overrides.id ?? 'tarea-default',
    titulo: overrides.titulo ?? 'Tarea de prueba',
    descripcion: overrides.descripcion ?? null,
    estado: overrides.estado ?? 'pendiente',
    fechaLimite: overrides.fechaLimite ?? null,
    fechaCompletado: overrides.fechaCompletado ?? null,
    creadoPor: overrides.creadoPor ?? 'usuario-1',
    creadoPorNombre: overrides.creadoPorNombre ?? 'Leandro',
    completadoPor: overrides.completadoPor ?? null,
    completadoPorNombre: overrides.completadoPorNombre ?? null,
    asignadoA: overrides.asignadoA !== undefined ? overrides.asignadoA : null,
    vencida: overrides.vencida ?? false,
    createdAt: overrides.createdAt ?? '2026-06-18T10:00:00Z',
  };
}

describe('Tareas', () => {
  let component: Tareas;
  let fixture: ComponentFixture<Tareas>;

  const mockApi = {
    getMisTareas: vi.fn().mockReturnValue(of([])),
    getTareas: vi.fn().mockReturnValue(of([])),
    getDistribucionSemanal: vi.fn().mockReturnValue(of(null)),
    deleteTarea: vi.fn(),
  };
  const mockHogaresApi = {
    getMiembros: vi.fn().mockReturnValue(of([])),
  };

  beforeEach(async () => {
    mockApi.getMisTareas.mockReset().mockReturnValue(of([]));
    mockApi.getTareas.mockReset().mockReturnValue(of([]));
    mockApi.getDistribucionSemanal.mockReset().mockReturnValue(of(null));
    mockApi.deleteTarea.mockReset();
    mockHogaresApi.getMiembros.mockReset().mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Tareas],
      providers: [
        ...appConfig.providers,
        { provide: TareasApiService, useValue: mockApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Tareas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('eliminarTarea should call api.deleteTarea and remove the task from the lists when confirmed', () => {
    const tarea = makeTarea({ id: 'tarea-1' });
    mockApi.deleteTarea.mockReturnValue(of(undefined));
    component['todasTareas'].set([tarea]);
    component['misTareas'].set([tarea]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const event = new MouseEvent('click');

    component['eliminarTarea'](tarea, event);

    expect(mockApi.deleteTarea).toHaveBeenCalledWith('tarea-1');
    expect(component['todasTareas']()).toEqual([]);
    expect(component['misTareas']()).toEqual([]);
  });

  it('eliminarTarea should not call api.deleteTarea when the user cancels the confirmation', () => {
    const tarea = makeTarea({ id: 'tarea-1' });
    mockApi.deleteTarea.mockReturnValue(of(undefined));
    component['todasTareas'].set([tarea]);
    component['misTareas'].set([tarea]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const event = new MouseEvent('click');

    component['eliminarTarea'](tarea, event);

    expect(mockApi.deleteTarea).not.toHaveBeenCalled();
    expect(component['todasTareas']()).toEqual([tarea]);
    expect(component['misTareas']()).toEqual([tarea]);
  });
});
