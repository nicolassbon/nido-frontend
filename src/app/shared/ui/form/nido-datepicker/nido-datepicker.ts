import {
  Component,
  Input,
  forwardRef,
  signal,
  computed,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
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
export class NidoDatepickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Seleccionar fecha';
  @Input() hasError    = false;

  protected isOpen     = signal(false);
  protected isDisabled = signal(false);
  protected value      = signal<string>(''); // YYYY-MM-DD

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

  protected open(): void {
    if (this.isDisabled()) return;
    if (this.value()) {
      const [y, m] = this.value().split('-').map(Number);
      this.viewYear.set(y);
      this.viewMonth.set(m - 1);
    }
    // Detectar si hay más espacio arriba o abajo
    const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUp.set(spaceBelow < 320);
    this.isOpen.set(true);
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
    this.onChange(date);
    this.onTouched();
    this.isOpen.set(false);
  }

  protected clear(e: Event): void {
    e.stopPropagation();
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && !this.el.nativeElement.contains(target) && this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  private toYMD(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  writeValue(v: string): void          { this.value.set(v ?? ''); }
  registerOnChange(fn: any): void      { this.onChange = fn; }
  registerOnTouched(fn: any): void     { this.onTouched = fn; }
  setDisabledState(d: boolean): void   { this.isDisabled.set(d); }
}
