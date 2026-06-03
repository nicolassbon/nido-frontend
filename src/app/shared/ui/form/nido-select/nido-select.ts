import {
  Component,
  Input,
  forwardRef,
  signal,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

export interface NidoSelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'nido-select',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nido-select.html',
  styleUrl: './nido-select.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NidoSelectComponent),
      multi: true,
    },
  ],
})
export class NidoSelectComponent implements ControlValueAccessor {
  @Input() options: NidoSelectOption[] = [];
  @Input() placeholder = 'Seleccionar...';
  @Input() hasError = false;

  protected isOpen    = signal(false);
  protected selected  = signal<any>(null);
  protected isDisabled = signal(false);

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void      = () => {};

  constructor(private el: ElementRef) {}

  get selectedLabel(): string {
    return this.options.find(o => o.value === this.selected())?.label ?? '';
  }

  protected openUp = signal(false);

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (!this.isOpen()) {
      // Detectar si hay más espacio arriba o abajo
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      this.openUp.set(spaceBelow < 260);
    }
    this.isOpen.update(v => !v);
    if (!this.isOpen()) this.onTouched();
  }

  protected select(opt: NidoSelectOption): void {
    this.selected.set(opt.value);
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && !this.el.nativeElement.contains(target) && this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  writeValue(v: any): void         { this.selected.set(v ?? null); }
  registerOnChange(fn: any): void  { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.isDisabled.set(d); }
}
