import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OpenFoodFactsService } from './open-food-facts.service';
import { environment } from '../../../environments/environment';

describe('OpenFoodFactsService', () => {
  let service: OpenFoodFactsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OpenFoodFactsService],
    });
    service = TestBed.inject(OpenFoodFactsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('lookup', () => {
    it('should return product data with weight extracted from name', () => {
      // Arrange
      const barcode = '7790630001234';
      const mockResponse = {
        name: 'Yogur Natural',
        image: 'https://example.com/yogur.jpg',
        brands: 'Brand A',
        categoriesTags: ['es:yogures'],
        categoriaSugerida: 'Lácteos',
        foundInDb: true,
        calorias: 50,
        proteinas: 3,
        carbohidratos: 5,
        grasas: 2,
        gramajeExtraido: 190,
      };

      // Act
      service.lookup(barcode).subscribe((product) => {
        // Assert
        expect(product.name).toBe('Yogur Natural');
        expect(product.gramajeExtraido).toBe(190);
        expect(product.calorias).toBe(50);      });

      // Assert HTTP request
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/productos/external-lookup/${encodeURIComponent(barcode)}`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should return empty product on API error', () => {
      // Arrange
      const barcode = 'invalid-barcode';

      // Act
      service.lookup(barcode).subscribe((product) => {
        // Assert
        expect(product.name).toBe('');
        expect(product.gramajeExtraido).toBeNull();
        expect(product.calorias).toBeNull();      });

      // Assert HTTP error
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/productos/external-lookup/${encodeURIComponent(barcode)}`,
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle product without nutritional data', () => {
      // Arrange
      const barcode = '1234567890123';
      const mockResponse = {
        name: 'Product Name',
        image: '',
        brands: '',
        categoriesTags: [],
        categoriaSugerida: 'General',
        foundInDb: false,
        calorias: null,
        proteinas: null,
        carbohidratos: null,
        grasas: null,
        gramajeExtraido: null,
      };

      // Act
      service.lookup(barcode).subscribe((product) => {
        // Assert
        expect(product.calorias).toBeNull();
        expect(product.proteinas).toBeNull();
        expect(product.gramajeExtraido).toBeNull();      });

      // Assert HTTP request
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/productos/external-lookup/${encodeURIComponent(barcode)}`,
      );
      req.flush(mockResponse);
    });

    it('should properly encode barcode in URL', () => {
      // Arrange
      const barcode = '123/456&789';

      // Act
      service.lookup(barcode).subscribe(() => {      });

      // Assert
      const expectedUrl = `${environment.apiBaseUrl}/productos/external-lookup/${encodeURIComponent(barcode)}`;
      const req = httpMock.expectOne(expectedUrl);
      req.flush({
        name: '',
        image: '',
        brands: '',
        categoriesTags: [],
        categoriaSugerida: 'General',
        foundInDb: false,
        calorias: null,
        proteinas: null,
        carbohidratos: null,
        grasas: null,
        gramajeExtraido: null,
      });
    });
  });
});
