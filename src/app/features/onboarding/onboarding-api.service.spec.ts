import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OnboardingApiService } from './onboarding-api.service';
import { environment } from '../../../environments/environment';

describe('OnboardingApiService', () => {
  let service: OnboardingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OnboardingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getPreferenciasAlimentarias() GETs /onboarding/preferencias-alimentarias', () => {
    const mock = [{ id: 'p1', nombre: 'Vegano', tipo: 'preferencia' }];

    service.getPreferenciasAlimentarias().subscribe(data => expect(data).toEqual(mock));

    const req = http.expectOne(`${environment.apiBaseUrl}/onboarding/preferencias-alimentarias`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('getAlergias() GETs /onboarding/alergias sin query params cuando no se pasa búsqueda', () => {
    const mock = [{ id: 'a1', nombre: 'Maní', tipo: 'alergia' }];

    service.getAlergias().subscribe(data => expect(data).toEqual(mock));

    const req = http.expectOne(`${environment.apiBaseUrl}/onboarding/alergias`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('q')).toBe(false);
    req.flush(mock);
  });

  it('getAlergias() envía el param q cuando se pasa un término de búsqueda', () => {
    service.getAlergias('gluten').subscribe();

    const req = http.expectOne(r => r.url.includes('/onboarding/alergias'));
    expect(req.request.params.get('q')).toBe('gluten');
    req.flush([]);
  });

  it('getMetas() GETs /onboarding/metas', () => {
    const mock = [{ id: 'm1', nombre: 'Ahorro' }];

    service.getMetas().subscribe(data => expect(data).toEqual(mock));

    const req = http.expectOne(`${environment.apiBaseUrl}/onboarding/metas`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('saveHouseholdStep() PATCHea /onboarding/step-2 con el body completo', () => {
    const body = {
      skip: false,
      usuarioId: 'u1',
      hogarId: 'h1',
      members: [{ nombre: 'Abi', rol: 'Pareja' }],
    };

    service.saveHouseholdStep(body).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/onboarding/step-2`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('saveWellnessStep() PATCHea /onboarding/step-4 con el body completo', () => {
    const body = {
      skip: false,
      usuarioId: 'u1',
      hogarId: 'h1',
      restriccionIds: ['r1', 'r2'],
      metaIds: ['m1'],
    };

    service.saveWellnessStep(body).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/onboarding/step-4`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });
});
