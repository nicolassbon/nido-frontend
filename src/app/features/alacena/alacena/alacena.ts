import {
  Component,
  computed,
  signal,
  inject,
  viewChild,
  ElementRef,
  effect,
  untracked,
  DestroyRef,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { OpenFoodFactsService } from '../open-food-facts.service';
import { getTtlForCategory, TtlInfo } from '../ttl.config';

// ── Types ────────────────────────────────────────────────────────────────────

type StorageLocation = 'Todos' | 'Alacena' | 'Freezer' | 'Heladera';
type ScannerStep     = 'scanning' | 'loading' | 'confirm' | 'error';

// BarcodeDetector is experimental; not yet in TypeScript's DOM lib.
type NativeBarcodeDetector = {
  new(options: { formats: string[] }): {
    detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>>;
  };
  getSupportedFormats(): Promise<string[]>;
};

export interface Product {
  id:               string;
  name:             string;
  image:            string;
  location:         Exclude<StorageLocation, 'Todos'>;
  expiryDate:       string;   // ISO date string (YYYY-MM-DD)
  quantity:         number;
  isOpened?:        boolean;
  remainingPercent?: number;  // 100 = full, 75 / 50 / 25 = approximate remaining
  barcode?:         string;
}

interface ProductDraft {
  name:              string;
  image:             string;
  location:          Exclude<StorageLocation, 'Todos'>;
  expiryDate:        string;
  ttlHint:           string;
  isOpened:          boolean;
  daysSincePurchase: number;
  consumedPercent:   number;
  notFound:          boolean;  // true when barcode scanned but product not in any DB
  quantity:          number;
  barcode:           string;
}

// ── Module-level utilities ────────────────────────────────────────────────────

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function makeEmptyDraft(): ProductDraft {
  return {
    name:              '',
    image:             '',
    location:          'Alacena',
    expiryDate:        toIsoDate(addDays(new Date(), 30)),
    ttlHint:           '',
    isOpened:          false,
    daysSincePurchase: 0,
    consumedPercent:   0,
    notFound:          false,
    quantity:          1,
    barcode:           '',
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGE = 'https://placehold.co/200x200/F7F1E6/927357?text=Sin+imagen';

const CONSUMED_OPTIONS: { label: string; value: number }[] = [
  { label: 'Recién abierto', value: 0  },
  { label: '~¼ consumido',   value: 25 },
  { label: '~La mitad',      value: 50 },
  { label: '~¾ consumido',   value: 75 },
];

const LOCATION_ICONS: Record<string, string> = {
  Todos:    'package',
  Alacena:  'tag',
  Freezer:  'snowflake',
  Heladera: 'refrigerator',
};

const LOCATION_COLORS: Record<string, string> = {
  Alacena:  '#C78F5A',
  Freezer:  '#3E5E4A',
  Heladera: '#927357',
};

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-alacena',
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './alacena.html',
  styleUrl: './alacena.scss',
})
export class Alacena {
  private readonly offService = inject(OpenFoodFactsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone       = inject(NgZone);

  // ── List & filters ───────────────────────────────────────
  protected readonly activeLocation  = signal<StorageLocation>('Todos');
  protected readonly searchQuery     = signal('');
  protected readonly locations:        StorageLocation[]                      = ['Todos', 'Alacena', 'Freezer', 'Heladera'];
  protected readonly productLocations: Exclude<StorageLocation, 'Todos'>[]   = ['Alacena', 'Freezer', 'Heladera'];
  protected readonly consumedOptions = CONSUMED_OPTIONS;
  protected readonly today           = toIsoDate(new Date());

  protected readonly products        = signal<Product[]>([]);

  protected readonly filteredProducts = computed(() => {
    let list = this.products();
    if (this.activeLocation() !== 'Todos') {
      list = list.filter(p => p.location === this.activeLocation());
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
    return list;
  });

  protected readonly urgentCount = computed(() =>
    this.products().filter(p => this.getDaysRemaining(p.expiryDate) <= 7).length
  );

  // ── Scanner state ────────────────────────────────────────
  protected readonly showScanner  = signal(false);
  protected readonly scannerStep  = signal<ScannerStep>('scanning');
  protected readonly scannerError = signal('');
  protected readonly draft        = signal<ProductDraft>(makeEmptyDraft());
  protected readonly submitted    = signal(false);
  private   readonly currentTtl   = signal<TtlInfo | null>(null);

  protected readonly draftErrors = computed(() => {
    if (!this.submitted()) return {} as Record<string, string>;
    const d = this.draft();
    const errors: Record<string, string> = {};
    if (d.name.trim().length < 2) {
      errors['name'] = 'El nombre debe tener al menos 2 caracteres.';
    }
    if (!d.expiryDate) {
      errors['expiryDate'] = 'Seleccioná la fecha de vencimiento.';
    }
    return errors;
  });

  protected readonly isDraftValid = computed(() => {
    const d = this.draft();
    return d.name.trim().length >= 2 && !!d.expiryDate;
  });

  // ── Camera ───────────────────────────────────────────────
  private readonly videoRef      = viewChild<ElementRef<HTMLVideoElement>>('videoRef');
  private readonly photoInputRef = viewChild<ElementRef<HTMLInputElement>>('photoInput');
  private scanControls?: { stop(): void };
  private codeReader?:  BrowserMultiFormatReader;
  private mediaStream?: MediaStream;
  private rafId?:       number;
  private scannerBusy  = false;
  private blobUrl?:     string;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCamera();
      if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    });

    effect(() => {
      const video = this.videoRef();
      if (video) {
        untracked(() => void this.startCamera(video.nativeElement));
      } else {
        untracked(() => this.stopCamera());
      }
    });
  }

  // ── Camera lifecycle ─────────────────────────────────────

  private async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    try {
      const BD = (window as Window & { BarcodeDetector?: NativeBarcodeDetector }).BarcodeDetector;
      if (BD) {
        await this.startNativeScanner(BD, videoEl);
      } else {
        await this.startZxingScanner(videoEl);
      }
    } catch {
      this.zone.run(() => {
        this.scannerStep.set('error');
        this.scannerError.set('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
      });
    }
  }

  private async startNativeScanner(
    BD: NativeBarcodeDetector,
    videoEl: HTMLVideoElement,
  ): Promise<void> {
    const supported = await BD.getSupportedFormats();
    const formats   = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
      .filter(f => supported.includes(f));

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    this.mediaStream  = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    const detector = new BD({ formats });

    const scan = async (): Promise<void> => {
      if (this.scannerBusy || this.scannerStep() !== 'scanning') return;
      try {
        const barcodes = await detector.detect(videoEl);
        if (barcodes.length > 0) {
          this.zone.run(() => this.onBarcodeDetected(barcodes[0].rawValue));
          return;
        }
      } catch { /* frame error — continue */ }
      this.rafId = requestAnimationFrame(() => void scan());
    };

    this.rafId = requestAnimationFrame(() => void scan());
  }

  private async startZxingScanner(videoEl: HTMLVideoElement): Promise<void> {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    this.codeReader = new BrowserMultiFormatReader(hints);

    const controls = await this.codeReader.decodeFromVideoDevice(
      undefined,
      videoEl,
      result => {
        if (result) this.zone.run(() => this.onBarcodeDetected(result.getText()));
      },
    );

    if (this.scannerStep() !== 'scanning') {
      controls.stop();
      return;
    }
    this.scanControls = controls;
  }

  private stopCamera(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    this.scanControls?.stop();
    this.scanControls = undefined;
    this.codeReader   = undefined;
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream  = undefined;
  }

  // ── Barcode handling ─────────────────────────────────────

  private onBarcodeDetected(barcode: string): void {
    if (this.scannerBusy || this.scannerStep() !== 'scanning') return;
    this.scannerBusy = true;

    if (!/^\d{8,14}$/.test(barcode)) {
      this.scannerBusy = false;
      return;
    }

    this.stopCamera();
    this.scannerStep.set('loading');

    this.offService.lookup(barcode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: product => {
        const ttl = getTtlForCategory(product.categoriesTags);
        this.currentTtl.set(ttl);

        // Always populate the draft so "add manually" has whatever data we found
        this.draft.set({
          ...makeEmptyDraft(),
          name:       product.name,
          image:      product.image,
          expiryDate: toIsoDate(addDays(new Date(), ttl.days)),
          ttlHint:    product.name ? ttl.hint : '',
          notFound:   !product.name,
          barcode,
        });

        if (!product.name) {
          this.scannerStep.set('error');
          this.scannerError.set(
            product.foundInDb
              ? 'Encontramos el código pero el producto no tiene nombre registrado.'
              : 'Producto no encontrado en ninguna base de datos.',
          );
          return;
        }

        this.scannerStep.set('confirm');
      },
      error: () => {
        this.scannerStep.set('error');
        this.scannerError.set('Error de conexión. Verificá tu internet e intentá de nuevo.');
      },
    });
  }

  // ── Expiry recalculation ─────────────────────────────────

  private recomputeExpiry(): void {
    const ttl = this.currentTtl();
    if (!ttl) return;
    const d       = this.draft();
    const baseDays = d.isOpened && ttl.openedDays !== null ? ttl.openedDays : ttl.days;
    const adjusted = Math.max(0, baseDays - d.daysSincePurchase);
    this.draft.update(prev => ({
      ...prev,
      expiryDate: toIsoDate(addDays(new Date(), adjusted)),
    }));
  }

  // ── Scanner actions ──────────────────────────────────────

  protected openScanner(): void {
    this.scannerBusy = false;
    this.currentTtl.set(null);
    this.draft.set(makeEmptyDraft());
    this.submitted.set(false);
    this.scannerError.set('');
    this.scannerStep.set('scanning');
    this.showScanner.set(true);
  }

  protected closeScanner(): void {
    this.stopCamera();
    this.showScanner.set(false);
  }

  protected retryScanner(): void {
    this.scannerBusy = false;
    this.currentTtl.set(null);
    this.draft.set(makeEmptyDraft());
    this.scannerError.set('');
    this.scannerStep.set('scanning');
  }

  protected addManually(): void {
    this.scannerStep.set('confirm');
  }

  // ── Form field updates ───────────────────────────────────

  protected updateDraftField<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected toggleOpened(opened: boolean): void {
    this.draft.update(d => ({ ...d, isOpened: opened, consumedPercent: 0 }));
    this.recomputeExpiry();
  }

  protected updateDaysSincePurchase(days: number): void {
    const clamped = Math.max(0, Math.min(60, Math.round(+days) || 0));
    this.draft.update(d => ({ ...d, daysSincePurchase: clamped }));
    this.recomputeExpiry();
  }

  protected updateConsumedPercent(pct: number): void {
    this.draft.update(d => ({ ...d, consumedPercent: pct }));
  }

  protected updateQuantity(delta: number): void {
    this.draft.update(d => ({ ...d, quantity: Math.max(1, d.quantity + delta) }));
  }

  protected triggerPhotoInput(): void {
    this.photoInputRef()?.nativeElement.click();
  }

  protected onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = URL.createObjectURL(file);
    this.draft.update(d => ({ ...d, image: this.blobUrl! }));
  }

  protected submitProduct(): void {
    this.submitted.set(true);
    if (!this.isDraftValid()) return;

    const d = this.draft();

    // If same barcode already in the list, add to its quantity instead of duplicating
    const existingIdx = d.barcode
      ? this.products().findIndex(p => p.barcode === d.barcode)
      : -1;

    if (existingIdx >= 0) {
      // TODO: PATCH /api/alacena/productos/:id
      this.products.update(list =>
        list.map((p, i) => i === existingIdx ? { ...p, quantity: p.quantity + d.quantity } : p),
      );
    } else {
      const product: Product = {
        id:               crypto.randomUUID(),
        name:             d.name.trim(),
        image:            d.image,
        location:         d.location,
        expiryDate:       d.expiryDate,
        quantity:         d.quantity,
        isOpened:         d.isOpened,
        remainingPercent: 100 - d.consumedPercent,
        barcode:          d.barcode || undefined,
      };
      // TODO: POST /api/alacena/productos
      this.products.update(list => [...list, product]);
    }

    this.closeScanner();
  }

  // ── Display helpers ──────────────────────────────────────

  protected getDaysRemaining(expiryDate: string): number {
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate + 'T00:00:00');
    return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  }

  protected getExpiryColor(days: number): string {
    if (days <  0)  return '#b44c3c';
    if (days <= 7)  return '#b44c3c';
    if (days <= 15) return '#C78F5A';
    if (days <= 30) return '#927357';
    return '#ccc5bb';
  }

  protected getExpiryWidth(days: number): number {
    return Math.min(Math.max((days / 60) * 100, 0), 100);
  }

  protected getExpiryLabel(days: number): string {
    if (days < 0)   return 'Vencido';
    if (days === 0) return 'Vence hoy';
    return `Vence en ${days} día${days === 1 ? '' : 's'}`;
  }

  protected getQuantityLabel(pct: number): string {
    if (pct >= 75) return '~¾ restante';
    if (pct >= 50) return '~Mitad';
    if (pct >= 25) return '~¼ restante';
    return 'Casi vacío';
  }

  protected getLocationIcon(location: StorageLocation): string {
    return LOCATION_ICONS[location] ?? 'package';
  }

  protected getLocationColor(location: StorageLocation): string {
    return LOCATION_COLORS[location] ?? '#263F30';
  }

  protected onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes('placehold.co')) img.src = PLACEHOLDER_IMAGE;
  }
}
