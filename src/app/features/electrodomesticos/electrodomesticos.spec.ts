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
  };

  beforeEach(async () => {
    mockService.getAll.mockReset().mockReturnValue(of([]));
    mockService.getCatalogo.mockReset().mockReturnValue(of([]));

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
});
