import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NidoDatepickerComponent } from './nido-datepicker';
import { LucideAngularModule } from 'lucide-angular';
import { appConfig } from '../../../../app.config';

describe('NidoDatepickerComponent', () => {
  let component: NidoDatepickerComponent;
  let fixture: ComponentFixture<NidoDatepickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NidoDatepickerComponent],
      providers: [
        ...appConfig.providers,
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NidoDatepickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open on trigger click', () => {
    const triggerEl = fixture.nativeElement.querySelector('.nido-dp__trigger') as HTMLElement;
    triggerEl.click();
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(true);
  });

  it('should format manual date inputs with masking', () => {
    const inputEl = fixture.nativeElement.querySelector('.nido-dp__input') as HTMLInputElement;

    // Simulate typing character by character
    component['onInputChange'](inputEl, '0');
    expect(inputEl.value).toBe('0');
    expect(component['inputValue']()).toBe('0');

    component['onInputChange'](inputEl, '04');
    expect(inputEl.value).toBe('04');
    expect(component['inputValue']()).toBe('04');

    component['onInputChange'](inputEl, '041');
    expect(inputEl.value).toBe('04/1');
    expect(component['inputValue']()).toBe('04/1');

    component['onInputChange'](inputEl, '04102026');
    expect(inputEl.value).toBe('04/10/2026');
    expect(component['inputValue']()).toBe('04/10/2026');

    // Should set the component's internal value when full and valid
    expect(component['value']()).toBe('2026-10-04');
  });

  it('should revert to last valid date on blur if input is left incomplete', () => {
    const inputEl = fixture.nativeElement.querySelector('.nido-dp__input') as HTMLInputElement;

    // Set a valid initial date
    component.writeValue('2026-10-04');
    fixture.detectChanges();
    expect(inputEl.value).toBe('04/10/2026');

    // Type incomplete date
    component['onInputChange'](inputEl, '12/0');
    expect(inputEl.value).toBe('12/0');

    // Trigger blur
    component['onInputBlur']();
    fixture.detectChanges();

    // Should revert back to the last valid value
    expect(inputEl.value).toBe('04/10/2026');
  });

  it('should close on document click outside the datepicker', () => {
    // Open datepicker first
    component['open']();
    fixture.detectChanges();
    expect(component['isOpen']()).toBe(true);

    // Simulate document click on an external element
    const externalEl = document.createElement('div');
    document.body.appendChild(externalEl);
    
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    externalEl.dispatchEvent(clickEvent);
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(false);

    document.body.removeChild(externalEl);
  });
});
