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
import { CommonModule } from '@angular/common';

@Component({
  selector: 'nido-timepicker',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nido-timepicker.html',
  styleUrl:    './nido-timepicker.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NidoTimepickerComponent),
      multi: true,
    },
  ],
})
export class NidoTimepickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = '--:--';
  @Input() hasError    = false;

  protected isOpen     = signal(false);
  protected isDisabled = signal(false);
  protected value      = signal<string>(''); // HH:MM

  protected hour       = signal<number>(12);
  protected minute     = signal<number>(0);

  protected readonly formattedHour = computed(() => String(this.hour()).padStart(2, '0'));
  protected readonly formattedMinute = computed(() => String(this.minute()).padStart(2, '0'));

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void         = () => {};

  constructor(private el: ElementRef) {
    document.addEventListener('click', this.onDocumentClick);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick);
  }

  private onDocumentClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && !this.el.nativeElement.contains(target) && this.isOpen()) {
      this.close();
    }
  };

  writeValue(val: string): void {
    if (val) {
      this.value.set(val);
      const parts = val.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h)) this.hour.set(h);
      if (!isNaN(m)) this.minute.set(m);
    } else {
      this.value.set('');
      this.hour.set(12);
      this.minute.set(0);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.isOpen()) {
      this.close();
    } else {
      this.isOpen.set(true);
    }
  }

  protected close(): void {
    this.isOpen.set(false);
    this.updateValue();
  }

  protected incrementHour(): void {
    this.hour.update(h => (h + 1) % 24);
    this.updateValue();
  }

  protected decrementHour(): void {
    this.hour.update(h => (h - 1 + 24) % 24);
    this.updateValue();
  }

  protected incrementMinute(): void {
    this.minute.update(m => (m + 5) % 60); // 5 min increments
    this.updateValue();
  }

  protected decrementMinute(): void {
    this.minute.update(m => (m - 5 + 60) % 60);
    this.updateValue();
  }

  private updateValue(): void {
    const hStr = String(this.hour()).padStart(2, '0');
    const mStr = String(this.minute()).padStart(2, '0');
    const timeStr = `${hStr}:${mStr}`;
    this.value.set(timeStr);
    this.onChange(timeStr);
    this.onTouched();
  }
}
