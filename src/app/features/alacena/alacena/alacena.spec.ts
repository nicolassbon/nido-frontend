import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../../app.config';
import { Alacena } from './alacena';
import { AlacenaApiService } from '../alacena-api.service';

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

  it('should filter products by expired status, expiring status, and both combined', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;

    const today = new Date();
    const expiryExpired = new Date(today);
    expiryExpired.setDate(today.getDate() - 3);
    
    const expirySoon = new Date(today);
    expirySoon.setDate(today.getDate() + 3);
    
    const expiryLate = new Date(today);
    expiryLate.setDate(today.getDate() + 20);

    component.products.set([
      { id: '1', name: 'Yogur Vencido', location: 'Heladera', expiryDate: expiryExpired.toISOString().split('T')[0], quantity: 1, unit: 'unidad' },
      { id: '2', name: 'Leche Nueva', location: 'Heladera', expiryDate: expirySoon.toISOString().split('T')[0], quantity: 1, unit: 'unidad' },
      { id: '3', name: 'Arroz Largo', location: 'Alacena', expiryDate: expiryLate.toISOString().split('T')[0], quantity: 1, unit: 'unidad' }
    ]);

    component.diasAlerta.set(7);

    // 1. Only Expired filter active
    component.onlyExpiring.set(false);
    component.onlyExpired.set(true);
    let filtered = component.filteredProducts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Yogur Vencido');

    // 2. Only Expiring filter active
    component.onlyExpiring.set(true);
    component.onlyExpired.set(false);
    filtered = component.filteredProducts();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Leche Nueva');

    // 3. Both active (Expired and Expiring)
    component.onlyExpiring.set(true);
    component.onlyExpired.set(true);
    filtered = component.filteredProducts();
    expect(filtered.length).toBe(2);
    const names = filtered.map((p: any) => p.name);
    expect(names).toContain('Yogur Vencido');
    expect(names).toContain('Leche Nueva');
    expect(names).not.toContain('Arroz Largo');

    // 4. Neither active
    component.onlyExpiring.set(false);
    component.onlyExpired.set(false);
    filtered = component.filteredProducts();
    expect(filtered.length).toBe(3);
  });

  it('should correctly classify products into expiringSoonProducts and expiredProducts', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;

    const today = new Date();
    const expiryExpired = new Date(today);
    expiryExpired.setDate(today.getDate() - 2);
    const expirySoon = new Date(today);
    expirySoon.setDate(today.getDate() + 4);
    const expiryLate = new Date(today);
    expiryLate.setDate(today.getDate() + 15);

    component.products.set([
      { id: '1', name: 'Vencido', location: 'Heladera', expiryDate: expiryExpired.toISOString().split('T')[0], quantity: 1, unit: 'unidad' },
      { id: '2', name: 'Próximo', location: 'Heladera', expiryDate: expirySoon.toISOString().split('T')[0], quantity: 1, unit: 'unidad' },
      { id: '3', name: 'Lejano', location: 'Alacena', expiryDate: expiryLate.toISOString().split('T')[0], quantity: 1, unit: 'unidad' }
    ]);

    component.diasAlerta.set(7);

    const expiringSoon = component.expiringSoonProducts();
    expect(expiringSoon.length).toBe(1);
    expect(expiringSoon[0].name).toBe('Próximo');

    const expired = component.expiredProducts();
    expect(expired.length).toBe(1);
    expect(expired[0].name).toBe('Vencido');

    expect(component.hasAnyWarning()).toBe(true);

    expect(component.getExpiryLabel(-2)).toBe('Vencido hace 2 días');
    expect(component.getExpiryLabel(-1)).toBe('Vencido hace 1 día');
  });

  it('should delete an expired product with vencido motive after confirmation', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;
    const alacenaApi = TestBed.inject(AlacenaApiService);
    const deleteSpy = vi.spyOn(alacenaApi, 'deleteStock').mockReturnValue(of(void 0));
    const event = new MouseEvent('click');
    const preventSpy = vi.spyOn(event, 'preventDefault');
    const stopSpy = vi.spyOn(event, 'stopPropagation');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const expiredStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

    component.products.set([
      { id: 'expired-1', name: 'Yogur', image: '', location: 'Heladera', expiryDate: expiredStr, quantity: 1, unit: 'unidad' },
      { id: 'ok-1', name: 'Arroz', image: '', location: 'Alacena', expiryDate: '', quantity: 1, unit: 'unidad' },
    ]);

    component.requestDeleteExpired(event, component.products()[0]);
    component.confirmDeleteProduct();

    expect(preventSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith('expired-1', 'vencido');
    expect(component.products().map((product: any) => product.id)).toEqual(['ok-1']);
  });

  it('should render history filters with initial labels on first switch', () => {
    const fixture = TestBed.createComponent(Alacena);
    const component = fixture.componentInstance as any;
    const alacenaApi = TestBed.inject(AlacenaApiService);
    vi.spyOn(alacenaApi, 'getMovimientos').mockReturnValue(of([]));

    component.switchView('historial');
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;

    expect(selects.length).toBe(2);
    expect(selects[0].value).toBe('todos');
    expect(selects[0].selectedOptions[0].textContent?.trim()).toBe('Todos');
    expect(selects[1].value).toBe('30');
    expect(selects[1].selectedOptions[0].textContent?.trim()).toBe('30 días');
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay movimientos.');
  });
});
