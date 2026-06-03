import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';

import { AgregarProducto } from './agregar-producto';
import { AlacenaApiService, StockItemResponse } from '../alacena/alacena-api.service';

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
});
