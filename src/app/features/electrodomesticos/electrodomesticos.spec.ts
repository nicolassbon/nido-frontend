import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Electrodomesticos } from './electrodomesticos';
import { ElectrodomesticosService } from './services/electrodomesticos.service';
import { appConfig } from '../../app.config';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('Electrodomesticos', () => {
  let component: Electrodomesticos;
  let fixture: ComponentFixture<Electrodomesticos>;

  const mockService = {
    getAll: vi.fn().mockReturnValue(of([])),
    getCatalogo: vi.fn().mockReturnValue(of([])),
    update: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    mockService.getAll.mockReset().mockReturnValue(of([]));
    mockService.getCatalogo.mockReset().mockReturnValue(of([]));
    mockService.update.mockReset();
    mockService.delete.mockReset();

    await TestBed.configureTestingModule({
      imports: [Electrodomesticos],
      providers: [
        ...appConfig.providers,
        { provide: ElectrodomesticosService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Electrodomesticos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('abrirModalEditar should prefill editDraft with the item tipo and estado', () => {
    const item = { id: 'e1', hogarId: 'h1', nombre: 'Heladera', tipo: 'Cocina', estado: 'activo', imagenUrl: null, marca: null };

    component['abrirModalEditar'](item);

    expect(component['showEditModal']()).toBe(true);
    expect(component['editTarget']()).toEqual(item);
    expect(component['editDraft']()).toEqual({ tipo: 'Cocina', estado: 'activo' });
  });

  it('guardarEdicion should call service.update and replace the item in the list', () => {
    const item = { id: 'e1', hogarId: 'h1', nombre: 'Heladera', tipo: 'Cocina', estado: 'activo', imagenUrl: null, marca: null };
    const actualizado = { ...item, tipo: 'Lavadero', estado: 'fuera de servicio' };
    mockService.update.mockReturnValue(of(actualizado));
    component['electrodomesticos'].set([item]);
    component['abrirModalEditar'](item);
    component['editDraft'].set({ tipo: 'Lavadero', estado: 'fuera de servicio' });

    component['guardarEdicion']();

    expect(mockService.update).toHaveBeenCalledWith('e1', { tipo: 'Lavadero', estado: 'fuera de servicio' });
    expect(component['electrodomesticos']()).toEqual([actualizado]);
    expect(component['showEditModal']()).toBe(false);
  });

  it('eliminarElectrodomestico should call service.delete and remove the item from the list', () => {
    const item = { id: 'e1', hogarId: 'h1', nombre: 'Heladera', tipo: 'Cocina', estado: 'activo', imagenUrl: null, marca: null };
    mockService.delete.mockReturnValue(of(undefined));
    component['electrodomesticos'].set([item]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const event = new MouseEvent('click');

    component['eliminarElectrodomestico'](item, event);

    expect(mockService.delete).toHaveBeenCalledWith('e1');
    expect(component['electrodomesticos']()).toEqual([]);
  });

  it('eliminarElectrodomestico should not call service.delete when the user cancels the confirmation', () => {
    const item = { id: 'e1', hogarId: 'h1', nombre: 'Heladera', tipo: 'Cocina', estado: 'activo', imagenUrl: null, marca: null };
    mockService.delete.mockReturnValue(of(undefined));
    component['electrodomesticos'].set([item]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const event = new MouseEvent('click');

    component['eliminarElectrodomestico'](item, event);

    expect(mockService.delete).not.toHaveBeenCalled();
    expect(component['electrodomesticos']()).toEqual([item]);
  });
});
