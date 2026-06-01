import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { appConfig } from '../../app.config';

import { AgregarProducto } from './agregar-producto';

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
});
