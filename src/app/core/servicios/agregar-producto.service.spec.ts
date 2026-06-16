import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductService, type CreateStockHomeRequest, type CreateStockHomeResponse } from './agregar-producto.service';

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('createStockHome() POSTs and returns the dedicated create response contract', async () => {
    const payload: CreateStockHomeRequest = {
      nombre: 'Yerba',
      categoriaId: '33333333-3333-3333-3333-333333333333',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: '2026-12-01',
    };
    const response: CreateStockHomeResponse = {
      stockHogarId: 'stock-1',
      productoId: 'prod-1',
      cantidadActual: 1,
      unidadMedida: 'kg',
      fechaVencimiento: '2026-12-01',
      usuarioIngresoId: 'user-1',
      ubicacion: 'Alacena',
      estaAbierto: false,
      porcentajeConsumido: 0,
      categoriaId: '33333333-3333-3333-3333-333333333333',
    };

    const resultPromise = firstValueFrom(service.createStockHome(payload));

    const req = http.expectOne(`${environment.apiBaseUrl}/productos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush(response);

    await expect(resultPromise).resolves.toEqual(response);
  });

  it('uploadProductImage() POSTs multipart data to the product image endpoint', () => {
    const file = new File(['image-bytes'], 'yerba.png', { type: 'image/png' });

    service.uploadProductImage('prod-1', file).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/productos/prod-1/imagen`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);

    const body = req.request.body as FormData;
    expect(body.get('imagen')).toBe(file);

    req.flush(null);
  });
});
