import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificacionesApiService, NotificacionResponse } from './notificaciones-api.service';
import { environment } from '../../../../environments/environment';

describe('NotificacionesApiService', () => {
  let service: NotificacionesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificacionesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getNotificaciones() GETs /notificaciones', () => {
    const mockData: NotificacionResponse[] = [
      { id: '1', usuarioId: 'u1', tipo: 't1', mensaje: 'msg1', leida: false, referenciaId: null, referenciaTipo: null, createdAt: '' },
    ];

    service.getNotificaciones().subscribe(data => expect(data).toEqual(mockData));

    const req = http.expectOne(`${environment.apiBaseUrl}/notificaciones`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('marcarComoLeida() POSTs /notificaciones/:id/leer', () => {
    service.marcarComoLeida('1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/notificaciones/1/leer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('marcarTodasComoLeidas() POSTs /notificaciones/leer-todas', () => {
    service.marcarTodasComoLeidas().subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/notificaciones/leer-todas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('eliminarNotificacion() DELETEs /notificaciones/:id', () => {
    service.eliminarNotificacion('1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/notificaciones/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
