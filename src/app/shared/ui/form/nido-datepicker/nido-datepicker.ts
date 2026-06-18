import {
  Component,
  Input,
  forwardRef,
  signal,
  computed,
  ElementRef,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

interface CalendarCell {
  date: string | null;
  day:  number | null;
}

@Component({
  selector: 'nido-datepicker',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nido-datepicker.html',
  styleUrl:    './nido-datepicker.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NidoDatepickerComponent),
      multi: true,
    },
  ],
})
export class NidoDatepickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = 'Seleccionar fecha';
  @Input() hasError    = false;

  protected isOpen     = signal(false);
  protected isDisabled = signal(false);
  protected value      = signal<string>(''); // YYYY-MM-DD
  protected inputValue = signal<string>(''); // DD/MM/YYYY

  protected viewYear  = signal(new Date().getFullYear());
  protected viewMonth = signal(new Date().getMonth()); // 0-indexed

  readonly dayNames   = DAY_NAMES;
  readonly todayStr   = this.toYMD(new Date());

  protected readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.viewMonth()]} ${this.viewYear()}`,
  );

  protected readonly calendarCells = computed<CalendarCell[]>(() => {
    const year  = this.viewYear();
    const month = this.viewMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ date: null, day: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day:  d,
      });
    }

    return cells;
  });

  protected get displayValue(): string {
    if (!this.value()) return '';
    const [y, m, d] = this.value().split('-');
    return `${d}/${m}/${y}`;
  }

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void         = () => {};

  constructor(private el: ElementRef) {}

  protected openUp = signal(false);

  private onDocumentClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && !this.el.nativeElement.contains(target) && this.isOpen()) {
      this.close();
    }
  };

  protected open(): void {
    if (this.isDisabled()) return;
    if (this.value()) {
      const [y, m] = this.value().split('-').map(Number);
      this.viewYear.set(y);
      this.viewMonth.set(m - 1);
    }
    // Detect space below to open upwards if needed
    const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUp.set(spaceBelow < 320);
    this.isOpen.set(true);

    // Register capture click listener on document to handle outside click correctly
    // bypassing any stopPropagation inside parent elements/modals
    document.addEventListener('click', this.onDocumentClick, true);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.onTouched();
    document.removeEventListener('click', this.onDocumentClick, true);
  }

  protected prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update(y => y - 1);
    } else {
      this.viewMonth.update(m => m - 1);
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update(y => y + 1);
    } else {
      this.viewMonth.update(m => m + 1);
    }
  }

  protected selectDate(date: string | null): void {
    if (!date) return;
    this.value.set(date);
    const [y, m, d] = date.split('-');
    this.inputValue.set(`${d}/${m}/${y}`);
    this.onChange(date);
    this.onTouched();
    this.close();
  }

  protected clear(e: Event): void {
    e.stopPropagation();
    this.value.set('');
    this.inputValue.set('');
    this.onChange('');
    this.onTouched();
  }

  protected onTriggerClick(e: MouseEvent): void {
    if (this.isDisabled()) return;

    const target = e.target as HTMLElement;
    if (target.closest('.nido-dp__clear') || target.closest('.nido-dp__panel')) {
      return;
    }

    const inputEl = (this.el.nativeElement as HTMLElement).querySelector('.nido-dp__input') as HTMLInputElement | null;
    if (inputEl && document.activeElement !== inputEl) {
      inputEl.focus();
    }

    if (!this.isOpen()) {
      this.open();
    }
  }

  protected onInputChange(inputEl: HTMLInputElement, val: string): void {
    // 1. Clean non-digit characters
    let cleaned = val.replace(/\D/g, '');

    // 2. Apply formatting mask: DD/MM/YYYY
    let formatted = '';
    if (cleaned.length > 0) {
      formatted += cleaned.substring(0, 2);
    }
    if (cleaned.length > 2) {
      formatted += '/' + cleaned.substring(2, 4);
    }
    if (cleaned.length > 4) {
      formatted += '/' + cleaned.substring(4, 8);
    }

    // Direct DOM manipulation guarantees display consistency during input filtering
    inputEl.value = formatted;
    this.inputValue.set(formatted);

    // If completely cleared, propagate empty value immediately
    if (cleaned === '') {
      if (this.value()) {
        this.value.set('');
        this.onChange('');
      }
      return;
    }

    // 3. Try parsing valid date
    if (formatted.length === 10) {
      const [dStr, mStr, yStr] = formatted.split('/');
      const d = parseInt(dStr, 10);
      const m = parseInt(mStr, 10);
      const y = parseInt(yStr, 10);

      if (y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && d >= 1) {
        const daysInMonth = new Date(y, m, 0).getDate();
        if (d <= daysInMonth) {
          const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          this.value.set(ymd);
          this.onChange(ymd);

          // Update calendar views
          this.viewYear.set(y);
          this.viewMonth.set(m - 1);
        }
      }
    }
  }

  protected onInputBlur(): void {
    this.onTouched();
    const val = this.value();
    let formatted = '';
    if (val) {
      const [y, m, d] = val.split('-');
      formatted = `${d}/${m}/${y}`;
    }
    this.inputValue.set(formatted);

    // Explicitly update DOM input value on blur to revert any half-typed invalid strings
    const inputEl = (this.el.nativeElement as HTMLElement).querySelector('.nido-dp__input') as HTMLInputElement | null;
    if (inputEl) {
      inputEl.value = formatted;
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick, true);
  }

  private toYMD(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  writeValue(v: string): void {
    const val = v ?? '';
    this.value.set(val);
    if (val) {
      const [y, m, d] = val.split('-');
      this.inputValue.set(`${d}/${m}/${y}`);
    } else {
      this.inputValue.set('');
    }
  }

  registerOnChange(fn: any): void      { this.onChange = fn; }
  registerOnTouched(fn: any): void     { this.onTouched = fn; }
  setDisabledState(d: boolean): void   { this.isDisabled.set(d); }
}
