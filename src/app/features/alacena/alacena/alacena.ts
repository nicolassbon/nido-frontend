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
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  MultiFormatReader,
  RGBLuminanceSource,
  BinaryBitmap,
  GlobalHistogramBinarizer,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library';
import { OpenFoodFactsService } from '../open-food-facts.service';
import { AlacenaApiService, StockItemResponse } from '../alacena-api.service';
import { PreferenciasApiService } from '../preferencias-api.service';
import { getTtlForCategory, TtlInfo } from '../ttl.config';
import { RouterLink } from '@angular/router';
import { ProductService, ProductManualResponse } from '../../../core/servicios/agregar-producto.service';
import { AgregarProducto, KnownProduct } from '../../agregar-producto/agregar-producto';
import { environment } from '../../../../environments/environment';

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
  quantity:         number;   // cantidad por envase
  unit?:            string;
  categoriaNombre?: string;
  isOpened?:        boolean;
  remainingPercent?: number;  // 100 = full, 75 / 50 / 25 = approximate remaining
  barcode?:         string;
  /** Cantidad de envases idénticos del mismo producto. Default 1. */
  packagesCount:    number;
}

interface ProductDraft {
  name:              string;
  image:             string;
  category:          string;
  location:          Exclude<StorageLocation, 'Todos'>;
  expiryDate:        string;
  ttlHint:           string;
  isOpened:          boolean;
  daysSincePurchase: number;
  consumedPercent:   number;
  notFound:          boolean;
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
    category:          '',
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

function resolveImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/productos/')) return imageUrl;

  const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '');
  const normalizedPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${baseUrl}${normalizedPath}`;
}

function normalizeProductName(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fallbackProductImage(name: string | null | undefined): string {
  const normalized = normalizeProductName(name);
  const catalog: Record<string, string> = {
    'aceite de oliva': '/productos/aceite-oliva.png',
    'ajo en polvo': '/productos/ajo-polvo.png',
    arroz: '/productos/arroz.png',
    arvejas: '/productos/arvejas.png',
    'cebolla en polvo': '/productos/cebolla-polvo.png',
    cebolla: '/productos/cebolla.png',
    harina: '/productos/harina.png',
    leche: '/productos/leche.png',
    manteca: '/productos/manteca.png',
    'muslo de pollo': '/productos/muslo-pollo.png',
    'oregano seco': '/productos/oregano-seco.png',
    'pasas de uva': '/productos/pasas-uva.png',
    'pimenton dulce': '/productos/pimenton-dulce.png',
    yogur: '/productos/yogur.png',
    queso: '/productos/queso.png',
    agua: '/productos/agua.png',
    fideos: '/productos/fideos.png',
    sal: '/productos/sal.png',
    salchicha: '/productos/salchicha.png',
    salmon: '/productos/salmon.png',
  };

  const aliases: Record<string, string> = {
    aceite: 'aceite de oliva',
    'aceite vegetal': 'aceite de oliva',
    'aji molido': 'pimenton dulce',
    'cebolla amarilla': 'cebolla',
    'cebolla grande': 'cebolla',
    'cebolla morada': 'cebolla',
    'harina comun': 'harina',
    oregano: 'oregano seco',
    pasas: 'pasas de uva',
    pimenton: 'pimenton dulce',
    'sal fina': 'sal',
    'sal gruesa': 'sal',
  };

  return catalog[normalized] ?? catalog[aliases[normalized]] ?? '';
}

function normalizeUnit(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases: Record<string, string> = {
    '': 'unidad',
    u: 'unidad',
    unidad: 'unidad',
    unidades: 'unidad',
    unit: 'unidad',
    gr: 'gr',
    g: 'gr',
    gramo: 'gr',
    gramos: 'gr',
    kg: 'kg',
    kilo: 'kg',
    kilos: 'kg',
    kilogramo: 'kg',
    kilogramos: 'kg',
    ml: 'ml',
    mililitro: 'ml',
    mililitros: 'ml',
    lt: 'lt',
    l: 'lt',
    litro: 'lt',
    litros: 'lt',
    cdita: 'cdita',
    cucharadita: 'cdita',
    cucharaditas: 'cdita',
    cdta: 'cdita',
    cda: 'cda',
    cucharada: 'cda',
    cucharadas: 'cda',
  };

  return aliases[normalized] ?? normalized;
}

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
  Alacena:  '#B48B6A',
  Freezer:  '#3E5E4A',
  Heladera: '#927357',
};

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-alacena',
  imports: [LucideAngularModule, FormsModule, RouterLink, AgregarProducto],
  templateUrl: './alacena.html',
  styleUrl: './alacena.scss',
})
export class Alacena implements OnInit {
  private readonly offService     = inject(OpenFoodFactsService);
  private readonly alacenaApi     = inject(AlacenaApiService);
  private readonly preferenciasApi = inject(PreferenciasApiService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly zone           = inject(NgZone);
  private readonly productService = inject(ProductService);


  // ── List & filters ───────────────────────────────────────
  protected readonly activeLocation  = signal<StorageLocation>('Todos');
  protected readonly searchQuery     = signal('');
  protected readonly locations:        StorageLocation[]                      = ['Todos', 'Alacena', 'Freezer', 'Heladera'];
  protected readonly productLocations: Exclude<StorageLocation, 'Todos'>[]   = ['Alacena', 'Freezer', 'Heladera'];
  protected readonly consumedOptions = CONSUMED_OPTIONS;
  protected readonly today           = toIsoDate(new Date());

  protected readonly products           = signal<Product[]>([]);
  protected readonly isLoadingProducts  = signal(false);
  protected readonly apiError           = signal<string | null>(null);

  /** Productos conocidos para el autocomplete del form de agregar */
  protected readonly knownProducts = computed<KnownProduct[]>(() =>
    this.products().map(p => ({
      nombre:           p.name,
      categoriaNombre:  p.categoriaNombre,
      unidadMedida:     p.unit,
      ubicacion:        p.location,
      stockId:          p.id,
      cantidad:         p.quantity,
      cantidadEnvases:  p.packagesCount,
    })),
  );

  protected readonly diasAlerta         = signal(7);
  protected readonly diasAlertaInput    = signal(7);
  protected readonly showAlertSettings  = signal(false);
  protected readonly isSavingPrefs      = signal(false);

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
    this.products().filter(p => {
      const days = this.getDaysRemaining(p.expiryDate);
      return days >= 0 && days <= this.diasAlerta();
    }).length
  );

  protected readonly expiringProducts = computed(() =>
    this.products()
      .filter(p => {
        const days = this.getDaysRemaining(p.expiryDate);
        return days >= 0 && days <= this.diasAlerta();
      })
      .sort((a, b) => this.getDaysRemaining(a.expiryDate) - this.getDaysRemaining(b.expiryDate))
  );

  // ── Scanner state ────────────────────────────────────────
  protected readonly showScanner      = signal(false);
  protected readonly showManualForm   = signal(false);
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

  // ── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProducts();
    this.loadPreferences();
  }

  private loadPreferences(): void {
    this.preferenciasApi.getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prefs => {
          this.diasAlerta.set(prefs.diasAlerta);
          this.diasAlertaInput.set(prefs.diasAlerta);
        },
      });
  }

  protected saveDiasAlerta(): void {
    const dias = Math.max(1, Math.min(365, Math.round(this.diasAlertaInput()) || 7));
    this.isSavingPrefs.set(true);
    this.preferenciasApi.updatePreferences(dias)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prefs => {
          this.diasAlerta.set(prefs.diasAlerta);
          this.diasAlertaInput.set(prefs.diasAlerta);
          this.isSavingPrefs.set(false);
          this.showAlertSettings.set(false);
        },
        error: () => {
          this.isSavingPrefs.set(false);
        },
      });
  }

protected reloadProducts(): void { this.loadProducts(); }

  private loadProducts(): void {
  this.isLoadingProducts.set(true);
  this.apiError.set(null);

  forkJoin({
    stock: this.alacenaApi.getStock(),
    manual: this.productService.getProductManual(),
  })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: ({ stock, manual }) => {
        const stockProducts = stock.map(item => this.toProduct(item));
        const manualProducts = manual.map(item => this.toManualProduct(item));

        const merged = [...stockProducts, ...manualProducts].filter(
          (product, index, list) =>
            list.findIndex(item => item.id === product.id) === index
        );

        this.products.set(merged);
        this.isLoadingProducts.set(false);
      },
      error: () => {
        this.apiError.set('No se pudo cargar el stock. Verificá la conexión.');
        this.isLoadingProducts.set(false);
      },
    });
}

  private toProduct(item: StockItemResponse): Product {
    return {
      id:               item.id,
      name:             item.nombre,
      image:            resolveImageUrl(item.imagen) || fallbackProductImage(item.nombre),
      location:         item.ubicacion as Exclude<StorageLocation, 'Todos'>,
      expiryDate:       item.fechaVencimiento ?? '',
      quantity:         item.cantidad ?? 0,
      unit:             normalizeUnit(item.unidadMedida),
      categoriaNombre:  item.categoriaNombre ?? undefined,
      isOpened:         item.estaAbierto,
      remainingPercent: 100 - item.porcentajeConsumido,
      barcode:          item.codigoBarras ?? undefined,
      packagesCount:    item.cantidadEnvases ?? 1,
    };
  }

  private toManualProduct(item: ProductManualResponse): Product {
  return {
    id: item.stockHogarId,
    name: item.nombre,
    image: resolveImageUrl(item.imagenUrl) || fallbackProductImage(item.nombre),
    location: item.ubicacion as Exclude<StorageLocation, 'Todos'>,
    expiryDate: item.fechaVencimiento ?? '',
    quantity: item.cantidad ?? 0,
    unit:             normalizeUnit(item.unidadMedida),
    categoriaNombre:  item.categoriaNombre ?? undefined,
    isOpened: item.estaAbierto,
    remainingPercent: 100 - item.porcentajeConsumido,
    barcode: item.codigoBarras ?? undefined,
    packagesCount: item.cantidadEnvases ?? 1,
  };
}

  // ── Camera lifecycle ─────────────────────────────────────

  private async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    try {
      const BD = (window as Window & { BarcodeDetector?: NativeBarcodeDetector }).BarcodeDetector;
      if (BD) {
        const supported = await BD.getSupportedFormats();
        const formats   = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(f => supported.includes(f));
        if (formats.length > 0) {
          await this.startNativeScanner(BD, videoEl, formats);
          return;
        }
      }
      await this.startZxingScanner(videoEl);
    } catch (err) {
      console.error('[Camera] error:', err);
      this.zone.run(() => {
        this.scannerStep.set('error');
        this.scannerError.set('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
      });
    }
  }

  private async startNativeScanner(
    BD: NativeBarcodeDetector,
    videoEl: HTMLVideoElement,
    formats: string[],
  ): Promise<void> {
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
      } catch { /* frame error — continuar */ }
      this.rafId = requestAnimationFrame(() => void scan());
    };

    this.rafId = requestAnimationFrame(() => void scan());
  }

  private async startZxingScanner(videoEl: HTMLVideoElement): Promise<void> {
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ];

    // Intento 1 (rápido): sin TRY_HARDER — ZXing escanea filas centrales solamente
    const fastHints = new Map<DecodeHintType, unknown>();
    fastHints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

    // Intento 2 (exhaustivo): con TRY_HARDER — busca en toda la imagen
    const thoroughHints = new Map<DecodeHintType, unknown>();
    thoroughHints.set(DecodeHintType.TRY_HARDER, true);
    thoroughHints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

    const browserReader = new BrowserMultiFormatReader(fastHints);
    const libReader     = new MultiFormatReader();
    libReader.setHints(thoroughHints);

    // Pedir 640×480: resolución óptima para detección de códigos de barras
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720  },
      },
    });
    this.mediaStream  = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d', { willReadFrequently: true })!;

    const doScan = (): void => {
      if (this.scannerStep() !== 'scanning') return;
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) { setTimeout(doScan, 100); return; }

      // Capear a 640px: suficiente resolución para EAN-13, mucho más rápido de procesar
      const scale = Math.min(1, 640 / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      canvas.width  = w;
      canvas.height = h;

      // Aumentar contraste al dibujar: ayuda a webcams con imagen lavada o con poca luz
      ctx.filter = 'contrast(1.5) brightness(1.05)';
      ctx.drawImage(videoEl, 0, 0, w, h);
      ctx.filter = 'none';

      // Intento 1: HybridBinarizer vía BrowserMultiFormatReader (maneja RGBA correctamente)
      try {
        const code = browserReader.decodeFromCanvas(canvas).getText();
        this.zone.run(() => this.onBarcodeDetected(code));
        return;
      } catch { /* continuar */ }

      // Intento 2: GlobalHistogramBinarizer — mejor para imágenes de bajo contraste
      try {
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const gray = new Uint8ClampedArray(w * h);
        for (let i = 0; i < gray.length; i++) {
          gray[i] = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) >> 2;
        }
        const src  = new RGBLuminanceSource(gray, w, h);
        const code = libReader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(src))).getText();
        this.zone.run(() => this.onBarcodeDetected(code));
        return;
      } catch { /* no barcode en este frame */ }

      setTimeout(doScan, 100);
    };

    setTimeout(doScan, 100);
  }

  private stopCamera(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    this.scanControls?.stop();
    this.scanControls = undefined;
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

    this.alacenaApi.findProductByBarcode(barcode)
      .pipe(
        switchMap(dbProduct => {
          if (dbProduct?.nombre) {
            const ttl = getTtlForCategory([]);
            return of({ name: dbProduct.nombre, image: dbProduct.imagen ?? '', category: dbProduct.categoriaNombre ?? '', ttl, fromDb: true });
          }
          return this.offService.lookup(barcode).pipe(
            switchMap(p => {
              const ttl = getTtlForCategory(p.categoriesTags);
              // El back mapea los tags crudos a una categoría canónica de Nido
              // (General, Lácteos, Bebidas, Congelados, Despensa).
              const category = p.categoriaSugerida || '';
              return of({ name: p.name, image: p.image, category, ttl, fromDb: p.foundInDb });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ name, image, category, ttl, fromDb }) => {
          this.currentTtl.set(ttl);
          this.draft.set({
            ...makeEmptyDraft(),
            name,
            image,
            category,
            expiryDate: toIsoDate(addDays(new Date(), ttl.days)),
            ttlHint:    name ? ttl.hint : '',
            notFound:   !name,
            barcode,
          });

          if (!name) {
            this.scannerStep.set('error');
            this.scannerError.set(
              fromDb
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

    const existing = d.barcode
      ? this.products().find(p => p.barcode === d.barcode)
      : undefined;

    if (existing) {
      const newQty = existing.quantity + d.quantity;
      this.alacenaApi
        .updateStock(existing.id, { cantidad: newQty })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: updated => {
            this.products.update(list =>
              list.map(p => p.id === existing.id ? this.toProduct(updated) : p),
            );
            this.closeScanner();
          },
          error: () => {
            this.products.update(list =>
              list.map(p => p.id === existing.id ? { ...p, quantity: newQty } : p),
            );
            this.closeScanner();
          },
        });
    } else {
      this.alacenaApi
        .createStock({
          nombre:              d.name.trim(),
          codigoBarras:        d.barcode || null,
          imagen:              d.image || null,
          ubicacion:           d.location,
          cantidad:            d.quantity,
          unidadMedida:        'unidad',
          fechaVencimiento:    d.expiryDate || null,
          estaAbierto:         d.isOpened,
          porcentajeConsumido: d.consumedPercent,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: created => {
            this.products.update(list => [...list, this.toProduct(created)]);
            this.closeScanner();
          },
          error: () => {
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
              packagesCount:    1,
            };
            this.products.update(list => [...list, product]);
            this.closeScanner();
          },
        });
    }
  }

  // ── Display helpers ──────────────────────────────────────

  protected getDaysRemaining(expiryDate: string): number {
    if (!this.hasExpiryDate(expiryDate)) return Number.POSITIVE_INFINITY;

    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate + 'T00:00:00');
    return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  }

  protected hasExpiryDate(expiryDate: string | null | undefined): boolean {
    if (!expiryDate) return false;

    const expiry = new Date(`${expiryDate}T00:00:00`);
    return !Number.isNaN(expiry.getTime());
  }

  protected getExpiryColor(days: number): string {
    if (days <  0)  return '#b44c3c';
    if (days <= 7)  return '#b44c3c';
    if (days <= 15) return '#B48B6A';
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

  /**
   * Etiqueta de cantidad para la card.
   * - 1 envase, unidad contable: "x3"
   * - 1 envase, unidad de medida: "100 g"
   * - N envases: "2 × 100 g" (o "2 × x3" para unidades contables)
   */
  protected quantityBadge(product: Product): string {
    const unit     = normalizeUnit(product.unit);
    const qty      = product.quantity;
    const packages = product.packagesCount ?? 1;

    const labels: Record<string, string> = {
      gr: 'g', kg: 'kg', ml: 'ml', lt: 'l', cda: 'cda', cdita: 'cdita',
    };

    const perPackage = unit === 'unidad'
      ? `x${qty}`
      : `${qty}${(labels[unit] ?? unit) === 'cda' || (labels[unit] ?? unit) === 'cdita' ? ' ' : ''}${labels[unit] ?? unit}`;

    return packages > 1 ? `${packages} × ${perPackage}` : perPackage;
  }

  protected getLocationIcon(location: StorageLocation): string {
    return LOCATION_ICONS[location] ?? 'package';
  }

  protected getLocationColor(location: StorageLocation): string {
    return LOCATION_COLORS[location] ?? '#263F30';
  }

  protected onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = fallbackProductImage(img.alt);
    const fallbackUrl = fallback ? new URL(fallback, window.location.origin).href : '';
    if (fallback && img.src !== fallbackUrl) {
      img.src = fallback;
      return;
    }
    if (!img.src.includes('placehold.co')) img.src = PLACEHOLDER_IMAGE;
  }

  // ── Tailwind class helpers ────────────────────────────────

  protected locationFilterChipClass(loc: StorageLocation): string {
    const base = 'px-4 py-[0.4rem] rounded-[20px] border-[1.5px] border-solid font-medium text-[0.8125rem] cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5';
    return this.activeLocation() === loc
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-white border-nido-border text-nido-brown hover:border-nido-green hover:text-nido-green`;
  }

  protected confirmImageClass(): string {
    return this.draft().image
      ? 'relative w-full h-[220px] shrink-0 rounded-[12px] overflow-hidden bg-nido-cream cursor-pointer transition-opacity duration-150 hover:opacity-95'
      : 'w-full h-[220px] shrink-0 rounded-[12px] flex flex-col items-center justify-center gap-2 bg-[#faf7f2] border-2 border-dashed border-[#d4c5b0] cursor-pointer transition-opacity duration-150 hover:opacity-95';
  }

  protected dayChipClass(active: boolean): string {
    const base = 'inline-flex items-center gap-1 py-[0.35rem] px-3 rounded-[16px] border-[1.5px] border-solid text-[0.775rem] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap';
    return active
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-white border-nido-border text-nido-brown hover:border-nido-green hover:text-nido-green`;
  }

  protected fieldInputClass(hasError: boolean, extra = ''): string {
    const base = 'py-[0.65rem] px-[0.875rem] border-[1.5px] border-solid rounded-lg text-[0.875rem] text-nido-green-dark bg-white outline-none transition-[border-color] duration-150 placeholder:text-nido-muted focus:border-nido-green box-border';
    return `${base} ${hasError ? 'border-nido-red' : 'border-nido-border'}${extra ? ' ' + extra : ''}`;
  }
}
