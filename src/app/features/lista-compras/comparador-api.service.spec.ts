import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ComparadorApiService, ComparePricesResponse } from './comparador-api.service';

describe('ComparadorApiService', () => {
  let service: ComparadorApiService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/productos/comparar`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ComparadorApiService],
    });

    service = TestBed.inject(ComparadorApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch price comparisons from api', () => {
    const mockResponse: ComparePricesResponse = {
      products: [
        {
          id: 'prod-1',
          source: 'Carrefour',
          name: 'Yerba Mate 1kg',
          link: 'http://carrefour.com/yerba',
          image: 'http://carrefour.com/yerba.jpg',
          price: 1500,
          unit: '1 kg',
          unitPrice: 1500,
        }
      ],
      failedScrapers: [],
      timestamp: new Date().toISOString(),
    };

    service.compararPrecios('yerba').subscribe(res => {
      expect(res).toBeTruthy();
      expect(res.products.length).toBe(1);
      expect(res.products[0].name).toBe('Yerba Mate 1kg');
      expect(res.products[0].price).toBe(1500);
    });

    const req = http.expectOne(`${baseUrl}?q=yerba`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
