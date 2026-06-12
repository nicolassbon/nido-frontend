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

  it('should normalize search query and match accent-containing product names', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;

    component.products.set([
      { id: '1', name: 'Café de Colombia', location: 'Alacena', expiryDate: '', quantity: 1, unit: 'unidad' },
      { id: '2', name: 'Yerba Mate', location: 'Alacena', expiryDate: '', quantity: 1, unit: 'unidad' }
    ]);

    component.searchQuery.set('cafe');
    let filtered = component.filteredProducts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Café de Colombia');

    component.searchQuery.set('CAFÉ');
    filtered = component.filteredProducts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Café de Colombia');
  });

  it('should filter products by next to expire status', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;

    const today = new Date();
    const expirySoon = new Date(today);
    expirySoon.setDate(today.getDate() + 3);
    const expiryLate = new Date(today);
    expiryLate.setDate(today.getDate() + 20);

    component.products.set([
      { id: '1', name: 'Leche', location: 'Heladera', expiryDate: expirySoon.toISOString().split('T')[0], quantity: 1, unit: 'unidad' },
      { id: '2', name: 'Arroz', location: 'Alacena', expiryDate: expiryLate.toISOString().split('T')[0], quantity: 1, unit: 'unidad' }
    ]);

    component.diasAlerta.set(7);
    component.onlyExpiring.set(true);

    let filtered = component.filteredProducts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Leche');
  });
});
