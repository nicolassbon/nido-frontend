import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { appConfig } from '../../../app.config';
import { Alacena } from './alacena';

describe('Alacena', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alacena],
      providers: [...appConfig.providers, provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Alacena);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show quantity badge for a single unit product', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance;

    const badge = component['quantityBadge']({
      id: 'stock-1',
      name: 'Leche',
      image: '',
      location: 'Alacena',
      expiryDate: '',
      quantity: 1,
      unit: 'unidad',
    });

    expect(badge).toBe('x1');
  });

  it('should show quantity badge for uppercase unit values', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance;

    const badge = component['quantityBadge']({
      id: 'stock-1',
      name: 'Huevos',
      image: '',
      location: 'Alacena',
      expiryDate: '',
      quantity: 1,
      unit: 'Unidad',
    });

    expect(badge).toBe('x1');
  });

  it('should show quantity badge for plural unit values', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance;

    const badge = component['quantityBadge']({
      id: 'stock-1',
      name: 'Manzanas',
      image: '',
      location: 'Alacena',
      expiryDate: '',
      quantity: 2,
      unit: 'unidades',
    });

    expect(badge).toBe('x2');
  });

  it('should keep measured unit badges readable', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance;

    const badge = component['quantityBadge']({
      id: 'stock-1',
      name: 'Harina',
      image: '',
      location: 'Alacena',
      expiryDate: '',
      quantity: 1.5,
      unit: 'kg',
    });

    expect(badge).toBe('1.5kg');
  });
});
