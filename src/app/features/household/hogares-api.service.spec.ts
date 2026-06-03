import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HogaresApiService } from './hogares-api.service';
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
});
