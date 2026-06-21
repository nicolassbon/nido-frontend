import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AlacenaApiService, CreateStockItemRequest, StockItemResponse } from './alacena-api.service';
import { environment } from '../../../environments/environment';

describe('AlacenaApiService - Nutritional Data Integration', () => {
  let service: AlacenaApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AlacenaApiService],
    });
    service = TestBed.inject(AlacenaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createStock', () => {
    it('should send nutritional data when creating a stock item', () => {
      const request: CreateStockItemRequest = {
        nombre: 'Yogur Natural 190g',
        categoriaId: null,
        codigoBarras: '7790630001234',
        imagen: 'https://example.com/yogur.jpg',
        ubicacion: 'Heladera',
        cantidad: 190,
        unidadMedida: 'gramos',
        fechaVencimiento: '2026-07-20',
        estaAbierto: false,
        porcentajeConsumido: 0,
        cantidadEnvases: 1,
        calorias: 50,
        proteinas: 3,
        carbohidratos: 5,
        grasas: 2,
      };

      service.createStock(request).subscribe((response) => {
        expect(response.calorias).toBe(50);
        expect(response.proteinas).toBe(3);
        expect(response.cantidad).toBe(190);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/alacena/productos`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.calorias).toBe(50);
      expect(req.request.body.cantidad).toBe(190);

      const mockResponse: StockItemResponse = {
        id: 'item-id',
        productoId: 'producto-id',
        nombre: 'Yogur Natural',
        imagen: 'https://example.com/yogur.jpg',
        codigoBarras: '7790630001234',
        categoriaNombre: 'Lácteos',
        ubicacion: 'Heladera',
        cantidad: 190,
        unidadMedida: 'gramos',
        fechaVencimiento: '2026-07-20',
        estaAbierto: false,
        porcentajeConsumido: 0,
        cantidadEnvases: 1,
        calorias: 50,
        proteinas: 3,
        carbohidratos: 5,
        grasas: 2,
        origenCarga: 'codigo_barras',
      };

      req.flush(mockResponse);
    });

    it('should handle null nutritional data gracefully', () => {
      const request: CreateStockItemRequest = {
        nombre: 'Pan Integral',
        categoriaId: null,
        codigoBarras: '123456789',
        imagen: '',
        ubicacion: 'Despensa',
        cantidad: 1,
        unidadMedida: null,
        fechaVencimiento: null,
        estaAbierto: false,
        porcentajeConsumido: 0,
        cantidadEnvases: 1,
        calorias: null,
        proteinas: null,
        carbohidratos: null,
        grasas: null,
      };

      service.createStock(request).subscribe((response) => {
        expect(response.calorias).toBeNull();
        expect(response.proteinas).toBeNull();
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/alacena/productos`);
      expect(req.request.body.calorias).toBeNull();

      const mockResponse: StockItemResponse = {
        id: 'item-id',
        productoId: 'producto-id',
        nombre: 'Pan Integral',
        imagen: '',
        codigoBarras: '123456789',
        categoriaNombre: 'Despensa',
        ubicacion: 'Despensa',
        cantidad: 1,
        unidadMedida: null,
        fechaVencimiento: null,
        estaAbierto: false,
        porcentajeConsumido: 0,
        cantidadEnvases: 1,
        calorias: null,
        proteinas: null,
        carbohidratos: null,
        grasas: null,
        origenCarga: 'manual',
      };

      req.flush(mockResponse);
    });
  });

  describe('getStock', () => {
    it('should retrieve stock items with nutritional data', () => {
      service.getStock().subscribe((items) => {
        expect(items.length).toBe(1);
        expect(items[0].calorias).toBe(60);
        expect(items[0].cantidad).toBe(200);
      });

      const req = httpMock.expectOne(`${environment.apiBaseUrl}/alacena/productos`);
      expect(req.request.method).toBe('GET');

      const mockResponse: StockItemResponse[] = [
        {
          id: 'item-1',
          productoId: 'producto-1',
          nombre: 'Leche Entera',
          imagen: 'https://example.com/leche.jpg',
          codigoBarras: '111111111111',
          categoriaNombre: 'Lácteos',
          ubicacion: 'Heladera',
          cantidad: 200,
          unidadMedida: 'ml',
          fechaVencimiento: '2026-06-30',
          estaAbierto: false,
          porcentajeConsumido: 0,
          cantidadEnvases: 1,
          calorias: 60,
          proteinas: 3,
          carbohidratos: 5,
          grasas: 3,
          origenCarga: 'manual',
        },
      ];

      req.flush(mockResponse);
    });
  });
});
