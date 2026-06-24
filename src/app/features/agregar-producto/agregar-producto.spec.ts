import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';

import { AgregarProducto } from './agregar-producto';
import { AlacenaApiService, StockItemResponse } from '../alacena/alacena-api.service';
import { ProductService } from '../../core/servicios/agregar-producto.service';
import { ListaComprasService } from '../lista-compras/lista-compras.service';

describe('AgregarProducto', () => {
  let component: AgregarProducto;
  let fixture: ComponentFixture<AgregarProducto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarProducto],
      providers: [
        ...appConfig.providers,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgregarProducto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should normalize unidad when editing an existing product', () => {
    component.stockItem = {
      id: 'stock-1',
      productoId: 'prod-1',
      nombre: 'Huevos',
      imagen: null,
      codigoBarras: null,
      categoriaNombre: 'General',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'Unidad',
      fechaVencimiento: null,
      estaAbierto: false,
      porcentajeConsumido: 0,
      cantidadEnvases: 1,
      calorias: null,
      proteinas: null,
      carbohidratos: null,
      grasas: null,
      origenCarga: 'manual',
    } satisfies StockItemResponse;

    component.ngOnInit();

    expect(component.form.controls.unidadMedida.value).toBe('unidad');
  });

  it('should submit updated unit when editing from unidad to kg', () => {
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const original: StockItemResponse = {
      id: 'stock-1',
      productoId: 'prod-1',
      nombre: 'Huevos',
      imagen: null,
      codigoBarras: null,
      categoriaNombre: 'General',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'Unidad',
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
    const updatedFromApi: StockItemResponse = {
      ...original,
      unidadMedida: 'unidad',
    };
    const updateSpy = vi.spyOn(alacenaApi, 'updateStock').mockReturnValue(of(updatedFromApi));
    const closedSpy = vi.spyOn(component.closed, 'emit');

    component.stockItem = original;
    component.ngOnInit();
    component.form.patchValue({ unidadMedida: 'kg' });

    component.onSubmit();

    expect(updateSpy).toHaveBeenCalledWith('stock-1', expect.objectContaining({ unidadMedida: 'kg' }));
    expect(closedSpy).toHaveBeenCalledWith(expect.objectContaining({ unidadMedida: 'kg' }));
  });

  it('should upload the selected image after creating a manual product', () => {
    const productService = TestBed.inject(ProductService);
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const createResponse: StockItemResponse = {
      id: 'stock-1',
      productoId: 'prod-1',
      nombre: 'Yerba',
      imagen: null,
      codigoBarras: null,
      categoriaNombre: null,
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: null,
      ubicacion: 'Alacena',
      estaAbierto: false,
      porcentajeConsumido: 0,
      cantidadEnvases: 1,
      calorias: null,
      proteinas: null,
      carbohidratos: null,
      grasas: null,
      origenCarga: 'manual',
    };
    const createSpy = vi.spyOn(alacenaApi, 'createStock').mockReturnValue(of(createResponse));
    const uploadSpy = vi.spyOn(productService, 'uploadProductImage').mockReturnValue(of(void 0));

    const image = new File(['image'], 'yerba.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [image],
      configurable: true,
    });

    component.form.patchValue({
      nombre: 'Yerba',
      categoriaId: '33333333-3333-3333-3333-333333333333',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: '',
    });
    component.onImageSelected({ target: input } as unknown as Event);

    component.onSubmit();

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ origenCarga: 'manual' }));
    expect(uploadSpy).toHaveBeenCalledWith('prod-1', image);
  });

  it('should create a pantry item from shopping history with quantity and unit without requiring category', () => {
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const createResponse: StockItemResponse = {
      id: 'stock-1',
      productoId: 'prod-1',
      nombre: 'Leche',
      imagen: null,
      codigoBarras: null,
      categoriaNombre: null,
      cantidad: 1,
      unidadMedida: 'lt',
      fechaVencimiento: null,
      ubicacion: 'Alacena',
      estaAbierto: false,
      porcentajeConsumido: 0,
      cantidadEnvases: 1,
      calorias: null,
      proteinas: null,
      carbohidratos: null,
      grasas: null,
      origenCarga: 'ticket_compra',
    };
    const createSpy = vi.spyOn(alacenaApi, 'createStock').mockReturnValue(of(createResponse));
    const savedSpy = vi.spyOn(component.saved, 'emit');

    component.initialProduct = {
      nombre: 'Leche',
      cantidad: 1,
      unidadMedida: 'lt',
      origenCarga: 'ticket_compra',
    };
    component.syncShoppingListOnSave = false;
    component.ngOnInit();

    component.onSubmit();

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Leche',
      categoriaId: null,
      cantidad: 1,
      unidadMedida: 'lt',
      origenCarga: 'ticket_compra',
    }));
    expect(savedSpy).toHaveBeenCalledWith(createResponse);
  });

  it('should keep the create flow successful when image upload fails', () => {
    const productService = TestBed.inject(ProductService);
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const shoppingListService = TestBed.inject(ListaComprasService);
    const createResponse: StockItemResponse = {
      id: 'stock-1',
      productoId: 'prod-1',
      nombre: 'Yerba',
      imagen: null,
      codigoBarras: null,
      categoriaNombre: null,
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: null,
      ubicacion: 'Alacena',
      estaAbierto: false,
      porcentajeConsumido: 0,
      cantidadEnvases: 1,
      calorias: null,
      proteinas: null,
      carbohidratos: null,
      grasas: null,
      origenCarga: 'manual',
    };

    vi.spyOn(alacenaApi, 'createStock').mockReturnValue(of(createResponse));
    vi.spyOn(productService, 'uploadProductImage').mockReturnValue(throwError(() => new Error('upload failed')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const closedSpy = vi.spyOn(component.closed, 'emit');
    const shoppingSpy = vi.spyOn(shoppingListService, 'marcarCompradoPorNombre');

    const image = new File(['image'], 'yerba.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [image],
      configurable: true,
    });

    component.form.patchValue({
      nombre: 'Yerba',
      categoriaId: '33333333-3333-3333-3333-333333333333',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: '',
    });
    component.onImageSelected({ target: input } as unknown as Event);

    component.onSubmit();

    expect(component['errorMessage']).toBe('');
    expect(component['warningMessage']).toBe('El producto se guardó, pero no se pudo subir la imagen.');
    expect(shoppingSpy).toHaveBeenCalledWith('Yerba');
    expect(closedSpy).not.toHaveBeenCalled();
    expect(component.form.getRawValue()).toEqual(expect.objectContaining({
      nombre: null,
      categoriaId: null,
      ubicacion: 'Alacena',
      cantidad: null,
      unidadMedida: null,
      fechaVencimiento: null,
    }));
  });

  it('should require removing the selected image before merging into an existing stock item', () => {
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const updateSpy = vi.spyOn(alacenaApi, 'updateStock').mockReturnValue(of({} as StockItemResponse));

    component.knownProducts = [{
      nombre: 'Yerba',
      unidadMedida: 'kg',
      stockId: 'stock-1',
      cantidad: 1,
    }];

    const image = new File(['image'], 'yerba.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [image],
      configurable: true,
    });

    component.form.patchValue({
      nombre: 'Yerba',
      categoriaId: '33333333-3333-3333-3333-333333333333',
      ubicacion: 'Alacena',
      cantidad: 1,
      unidadMedida: 'kg',
      fechaVencimiento: '',
    });
    component.onImageSelected({ target: input } as unknown as Event);

    component.onSubmit();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(component['imageError']()).toBe('Este producto ya existe en tu alacena. Quitá la imagen seleccionada para sumar cantidad sin crear duplicados.');
  });
});
