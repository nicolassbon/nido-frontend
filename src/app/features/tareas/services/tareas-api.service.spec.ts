import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { TareasApiService, TareaResponse, DistribucionSemanalResponse } from './tareas-api.service';

describe('TareasApiService', () => {
  let service: TareasApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/tareas`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TareasApiService],
    });
    service = TestBed.inject(TareasApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getTareas should GET /tareas and return the list', () => {
    let result: TareaResponse[] | undefined;
    service.getTareas().subscribe(t => (result = t));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([makeTarea({ titulo: 'Limpiar cocina' }), makeTarea({ titulo: 'Sacar basura' })]);

    expect(result).toHaveLength(2);
    expect(result![0].titulo).toBe('Limpiar cocina');
  });

  it('getMisTareas should GET /tareas/mis-tareas', () => {
    let result: TareaResponse[] | undefined;
    service.getMisTareas().subscribe(t => (result = t));

    const req = http.expectOne(`${base}/mis-tareas`);
    expect(req.request.method).toBe('GET');
    req.flush([makeTarea({ titulo: 'Mi tarea' })]);

    expect(result).toHaveLength(1);
    expect(result![0].titulo).toBe('Mi tarea');
  });

  it('getDistribucionSemanal should GET /tareas/distribucion-semanal', () => {
    let result: DistribucionSemanalResponse | undefined;
    service.getDistribucionSemanal().subscribe(d => (result = d));

    const req = http.expectOne(`${base}/distribucion-semanal`);
    expect(req.request.method).toBe('GET');
    req.flush(makeDistribucion());

    expect(result?.dias).toHaveLength(7);
  });

  it('createTarea should POST /tareas with the correct body', () => {
    const nueva = { titulo: 'Barrer', descripcion: null, fechaLimite: null, asignadoA: null };
    let result: TareaResponse | undefined;
    service.createTarea(nueva).subscribe(t => (result = t));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.titulo).toBe('Barrer');
    expect(req.request.body.asignadoA).toBeNull();
    req.flush(makeTarea({ titulo: 'Barrer' }));

    expect(result?.titulo).toBe('Barrer');
  });

  it('updateTarea should PATCH /tareas/:id with the fields to update', () => {
    const id = 'tarea-123';
    let result: TareaResponse | undefined;
    service.updateTarea(id, { estado: 'en_progreso' }).subscribe(t => (result = t));

    const req = http.expectOne(`${base}/${id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.estado).toBe('en_progreso');
    req.flush(makeTarea({ id, estado: 'en_progreso' }));

    expect(result?.estado).toBe('en_progreso');
  });

  it('completarTarea should POST /tareas/:id/completar with an empty body', () => {
    const id = 'tarea-456';
    let result: TareaResponse | undefined;
    service.completarTarea(id).subscribe(t => (result = t));

    const req = http.expectOne(`${base}/${id}/completar`);
    expect(req.request.method).toBe('POST');
    req.flush(makeTarea({ id, estado: 'completada', fechaCompletado: '2026-06-18T12:00:00Z' }));

    expect(result?.estado).toBe('completada');
    expect(result?.fechaCompletado).toBe('2026-06-18T12:00:00Z');
  });

  it('asignarTarea should POST /tareas/:id/asignar with the usuarioId', () => {
    const id = 'tarea-789';
    const usuarioId = 'usuario-abc';
    let result: TareaResponse | undefined;
    service.asignarTarea(id, usuarioId).subscribe(t => (result = t));

    const req = http.expectOne(`${base}/${id}/asignar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.usuarioId).toBe(usuarioId);
    req.flush(makeTarea({
      id,
      asignadoA: { usuarioId, nombre: 'Ana', fotoStorageKey: null },
    }));

    expect(result?.asignadoA?.usuarioId).toBe(usuarioId);
  });

  it('asignarTarea with null should send null to unassign', () => {
    const id = 'tarea-101';
    service.asignarTarea(id, null).subscribe();

    const req = http.expectOne(`${base}/${id}/asignar`);
    expect(req.request.body.usuarioId).toBeNull();
    req.flush(makeTarea({ id, asignadoA: null }));
  });

  it('deleteTarea should DELETE /tareas/:id', () => {
    const id = 'tarea-delete';
    let completed = false;
    service.deleteTarea(id).subscribe(() => (completed = true));

    const req = http.expectOne(`${base}/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });
});

function makeTarea(overrides: Partial<TareaResponse & { id: string }> = {}): TareaResponse {
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

function makeDistribucion(): DistribucionSemanalResponse {
  const dias = ['Lun', 'Mar', 'Mier', 'Jue', 'Vie', 'Sab', 'Dom'];
  return {
    dias: dias.map((dia, i) => ({
      dia,
      fecha: new Date(2026, 5, 15 + i).toISOString(),
      miembros: [],
    })),
  };
}
