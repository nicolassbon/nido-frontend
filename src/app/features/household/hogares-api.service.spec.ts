import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  CambiarHogarResponse,
  CrearHogarResponse,
  HogaresApiService,
  HogarResumenResponse,
  HogarResponse,
} from './hogares-api.service';
import { environment } from '../../../environments/environment';

describe('HogaresApiService', () => {
  let service: HogaresApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HogaresApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getMiembros() GETs /hogares/miembros', () => {
    const mockData = [
      { usuarioId: 'u1', nombre: 'Ana', email: 'ana@test.com', rol: 'admin', fotoUrl: null, alergias: ['Gluten'] },
    ];

    service.getMiembros().subscribe(data => expect(data).toEqual(mockData));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/miembros`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('invitar() POSTs email to /hogares/invitar', () => {
    service.invitar('invitado@test.com').subscribe(res => expect(res.token).toBe('tok123'));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/invitar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ emailInvitado: 'invitado@test.com' });
    req.flush({ token: 'tok123' });
  });

  it('aceptarInvitacion() POSTs token to /hogares/aceptar-invitacion', () => {
    const mockRes = { hogarId: 'h1', hogarNombre: 'Nido Familiar', accessToken: 'jwt-abc' };

    service.aceptarInvitacion('invite-xyz').subscribe(res => expect(res).toEqual(mockRes));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/aceptar-invitacion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'invite-xyz' });
    req.flush(mockRes);
  });

  it('getMisHogares() GETs /hogares/mis-hogares', () => {
    const mockData: HogarResumenResponse[] = [
      { id: 'h-1', nombre: 'Mi hogar', rol: 'owner' },
      { id: 'h-2', nombre: 'Casa verano', rol: 'integrante' },
    ];

    service.getMisHogares().subscribe(data => expect(data).toEqual(mockData));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/mis-hogares`);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('activarHogar() POSTs to /hogares/{id}/activar', () => {
    const mockRes: CambiarHogarResponse = { hogarId: 'h-2', hogarNombre: 'Casa verano', accessToken: 'jwt-abc' };

    service.activarHogar('h-2').subscribe(res => expect(res).toEqual(mockRes));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/h-2/activar`);
    expect(req.request.method).toBe('POST');
    req.flush(mockRes);
  });

  it('crearHogar() POSTs nombre to /hogares', () => {
    const mockRes: CrearHogarResponse = { hogarId: 'h-3', hogarNombre: 'Nuevo hogar', accessToken: 'jwt-xyz' };

    service.crearHogar('Nuevo hogar').subscribe(res => expect(res).toEqual(mockRes));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Nuevo hogar' });
    req.flush(mockRes);
  });

  it('renombrarHogar() PATCHes nombre to /hogares/{id}', () => {
    const mockRes: HogarResponse = { id: 'h-1', nombre: 'Casa renombrada' };

    service.renombrarHogar('h-1', 'Casa renombrada').subscribe(res => expect(res).toEqual(mockRes));

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/h-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ nombre: 'Casa renombrada' });
    req.flush(mockRes);
  });

  it('eliminarHogar() DELETEs /hogares/{id}', () => {
    let completed = false;
    service.eliminarHogar('h-2').subscribe({ complete: () => (completed = true) });

    const req = http.expectOne(`${environment.apiBaseUrl}/hogares/h-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });
});
