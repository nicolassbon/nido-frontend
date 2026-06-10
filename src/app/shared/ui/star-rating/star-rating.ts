import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Estrellas de calificación reutilizable.
 *
 * - `readonly` (default): solo muestra (puede ser decimal: 3.5 = 3 enteras + media).
 * - `interactive`: permite seleccionar haciendo hover/click.
 *
 * Emite `valueChange` cuando el usuario elige una calificación.
 */
@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center gap-0.5" [class.cursor-pointer]="interactive">
      @for (i of stars; track i) {
        @let active = hovered() > 0 ? hovered() >= i : value >= i - 0.5;
        @let half   = !interactive && value >= i - 0.5 && value < i;
        <button type="button"
                class="inline-flex items-center justify-center bg-transparent border-none p-0 m-0"
                [class.cursor-default]="!interactive"
                [class.cursor-pointer]="interactive"
                [disabled]="!interactive"
                (mouseenter)="interactive && hovered.set(i)"
                (mouseleave)="interactive && hovered.set(0)"
                (click)="onClick(i)">
          <lucide-icon
            [name]="active ? 'star' : (half ? 'star-half' : 'star')"
            [size]="iconSize"
            [strokeWidth]="active ? 1.5 : 1.5"
            [class.text-nido-gold]="active || half"
            [class.text-nido-border]="!active && !half"
            [class.fill-nido-gold]="active || half"
            [class.fill-transparent]="!active && !half" />
        </button>
      }
      @if (showValue && value > 0) {
        <span class="ml-1.5 text-[0.8125rem] font-semibold text-nido-green-dark">{{ value.toFixed(1) }}</span>
      }
    </div>
  `,
})
export class StarRatingComponent {
  /** Valor actual (0-5). Acepta decimales para mostrar promedios (3.5). */
  @Input() value = 0;

  /** Si true permite cliquear estrellas. Si false (default) es solo display. */
  @Input() interactive = false;

  /** Muestra el número junto a las estrellas (ej: "4.2"). */
  @Input() showValue = false;

  /** Tamaño de cada estrella. */
  @Input() iconSize = 16;

  @Output() valueChange = new EventEmitter<number>();

  protected readonly stars   = [1, 2, 3, 4, 5];
  protected readonly hovered = signal(0);

  protected onClick(i: number): void {
    if (!this.interactive) return;
    this.value = i;
    this.valueChange.emit(i);
  }
}
