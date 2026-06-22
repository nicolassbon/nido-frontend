import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Aviso de que las fechas de vencimiento son **estimadas** y no garantizadas.
 *
 * Se usa cerca de cualquier campo o display de fecha de vencimiento (form de
 * carga, detalle de producto, lista de alertas, etc.) para que el usuario
 * sepa que debe verificar siempre el envase real del producto.
 *
 * El componente es presentacional y standalone — sin dependencias de servicios.
 * Por defecto usa el variant 'inline'; los variants compactos sirven cerca de
 * campos de form, los más visibles para banners de alerta.
 */
@Component({
  selector: 'app-estimated-date-notice',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-start gap-2 rounded-lg border border-nido-gold/35 bg-nido-gold/10 px-3 py-2 text-[0.75rem] leading-snug text-nido-brown"
      [class.py-1.5]="variant === 'compact'"
      [class.px-2.5]="variant === 'compact'"
      [class.text-[0.7rem]]="variant === 'compact'">
      <lucide-icon name="info" [size]="variant === 'compact' ? 12 : 14" class="shrink-0 mt-px text-nido-gold" />
      <span>
        {{ message }}
      </span>
    </div>
  `,
})
export class EstimatedDateNoticeComponent {
  /** Densidad visual. 'compact' usa menos padding y texto más chico. */
  @Input() variant: 'inline' | 'compact' = 'inline';

  /** Texto del aviso. Default sirve para la mayoría de los casos. */
  @Input() message =
    'Las fechas de vencimiento son estimadas. Siempre verificá el envase real del producto antes de consumirlo.';
}
