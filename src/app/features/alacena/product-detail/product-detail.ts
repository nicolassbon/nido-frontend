import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AgregarProducto } from '../../agregar-producto/agregar-producto';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProductManualResponse, ProductService } from '../../../core/servicios/agregar-producto.service';
import { ListaComprasService } from '../../lista-compras/lista-compras.service';
import { AlacenaApiService, StockItemResponse } from '../alacena-api.service';

const SHOPPING_GROUP = 'Productos de alacena';

function resolveImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;

  const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
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
    arroz: '/productos/arroz.png',
    leche: '/productos/leche.png',
    yogur: '/productos/yogur.png',
    queso: '/productos/queso.png',
    agua: '/productos/agua.png',
    fideos: '/productos/fideos.png',
    sal: '/productos/sal.png',
  };

  const key = Object.keys(catalog).find(item => normalized === item || normalized.includes(item));
  return key ? catalog[key] : '';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, AgregarProducto],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alacenaApi = inject(AlacenaApiService);
  private readonly productService = inject(ProductService);
  private readonly listaService = inject(ListaComprasService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly product = signal<StockItemResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly imageFailed = signal(false);
  protected readonly listMessage = signal<string | null>(null);
  protected readonly finishing    = signal(false);
  protected readonly showEditModal = signal(false);

  protected readonly imageUrl = computed(() =>
    this.imageFailed()
      ? ''
      : fallbackProductImage(this.product()?.nombre) || resolveImageUrl(this.product()?.imagen),
  );

  protected readonly remainingPercent = computed(() =>
    clamp(100 - (this.product()?.porcentajeConsumido ?? 0), 0, 100),
  );

  protected readonly brand = computed(() => {
    const name = this.product()?.nombre.trim() ?? '';
    if (!name) return 'Sin marca';

    const words = name.split(/\s+/).filter(Boolean);
    const first = this.normalizeToken(words[0] ?? '');
    const genericWords = new Set([
      'aceite',
      'agua',
      'arroz',
      'azucar',
      'cafe',
      'fideos',
      'galletitas',
      'harina',
      'leche',
      'manteca',
      'pan',
      'pollo',
      'queso',
      'sal',
      'yerba',
      'yogur',
    ]);

    if (words.length > 1 && genericWords.has(first)) return this.cleanBrand(words[1]);
    return this.cleanBrand(words[0]);
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (!id) {
          this.errorMessage.set('No encontramos el producto solicitado.');
          return;
        }

        this.loadProduct(id);
      });
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.imageFailed.set(false);
    this.listMessage.set(null);

    this.alacenaApi
      .getStockById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: product => {
          this.product.set(product);
          this.loading.set(false);
        },
        error: () => this.loadProductFromLists(id),
      });
  }

  private loadProductFromLists(id: string): void {
    forkJoin({
      stock: this.alacenaApi.getStock(),
      manual: this.productService.getProductManual(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stock, manual }) => {
          const stockItem = stock.find(item => item.id === id || item.productoId === id);
          const manualItem = manual.find(item => item.stockHogarId === id || item.productoId === id);
          const product = stockItem ?? (manualItem ? this.toStockItem(manualItem) : null);

          if (!product) {
            this.errorMessage.set('No se pudo cargar el producto. Probablemente ya no esta en tu alacena.');
            this.loading.set(false);
            return;
          }

          this.product.set(product);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar el producto. Probablemente ya no esta en tu alacena.');
          this.loading.set(false);
        },
      });
  }

  private toStockItem(item: ProductManualResponse): StockItemResponse {
    return {
      id: item.stockHogarId,
      productoId: item.productoId,
      nombre: item.nombre,
      imagen: item.imagenUrl,
      codigoBarras: item.codigoBarras,
      categoriaNombre: item.categoriaNombre,
      ubicacion: item.ubicacion,
      cantidad: item.cantidad,
      unidadMedida: item.unidadMedida,
      fechaVencimiento: item.fechaVencimiento,
      estaAbierto: item.estaAbierto,
      porcentajeConsumido: item.porcentajeConsumido,
    };
  }

  protected goBack(): void {
    this.router.navigate(['/alacena']);
  }

  protected onEditClosed(): void {
    this.showEditModal.set(false);
    const id = this.product()?.id;
    if (id) this.loadProduct(id);
  }

  protected onImageError(event: Event, productName: string): void {
    const image = event.target as HTMLImageElement;
    const fallback = fallbackProductImage(productName);
    const fallbackUrl = fallback ? new URL(fallback, window.location.origin).href : '';

    if (fallback && image.src !== fallbackUrl) {
      image.src = fallback;
      return;
    }

    this.imageFailed.set(true);
  }

  protected addToShoppingList(): void {
    const product = this.product();
    if (!product) return;

    const currentGroup = this.listaService.snapshot.find(group => group.recetaNombre === SHOPPING_GROUP);
    const existingItems = currentGroup?.items ?? [];
    const exists = existingItems.some(item => item.nombre.trim().toLowerCase() === product.nombre.trim().toLowerCase());
    const nextItems = exists
      ? existingItems
      : [
          ...existingItems,
          {
            nombre: product.nombre,
            cantidad: product.cantidad || 1,
            unidad: this.displayUnit(product.unidadMedida),
            checked: false,
          },
        ];

    this.listaService.addToLista(SHOPPING_GROUP, nextItems);
    this.listMessage.set(exists ? 'Ya estaba en tu lista.' : 'Agregado a la lista.');
  }

  protected finishProduct(): void {
    const product = this.product();
    if (!product || this.finishing()) return;

    this.finishing.set(true);
    this.alacenaApi
      .deleteStock(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/alacena']),
        error: () => {
          this.finishing.set(false);
          this.errorMessage.set('No se pudo marcar como terminado. Intenta de nuevo.');
        },
      });
  }

  protected formatAmount(value: number | null | undefined, unit: string | null | undefined): string {
    const suffix = this.displayUnit(unit);
    if (value === null || value === undefined) return suffix || '-';
    const formatted = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
    return `${formatted}${suffix ? ` ${suffix}` : ''}`;
  }

  protected quantitySummary(product: StockItemResponse): string {
    const current = this.formatAmount(product.cantidad, product.unidadMedida);
    const consumed = clamp(product.porcentajeConsumido, 0, 99);
    if (consumed <= 0 || product.cantidad <= 0) return current;

    const total = product.cantidad / ((100 - consumed) / 100);
    return `${current} / ${this.formatAmount(total, product.unidadMedida)}`;
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) return 'Sin fecha';

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  protected consumptionText(product: StockItemResponse): string {
    if (!product.estaAbierto) return 'Producto cerrado o sin consumo registrado.';
    if (product.porcentajeConsumido <= 0) return 'Esta abierto, pero todavia no registraste consumo.';
    return `Aproximadamente ${product.porcentajeConsumido}% consumido.`;
  }

  protected restockText(product: StockItemResponse): string {
    const days = this.daysUntilExpiry(product.fechaVencimiento);
    if (days < 0) return 'Conviene reponer este producto pronto.';
    if (days <= 3) return `Te recomendamos reponerlo en ${Math.max(1, days - 2)} dias.`;
    return 'No hace falta reponer todavia.';
  }

  protected adviceText(product: StockItemResponse): string {
    const category = (product.categoriaNombre ?? product.ubicacion ?? '').toLowerCase();
    const name = product.nombre.toLowerCase();

    if (category.includes('freezer') || product.ubicacion.toLowerCase() === 'freezer') {
      return 'Mantenelo bien cerrado y etiquetado para conservar mejor la textura.';
    }
    if (category.includes('heladera') || product.ubicacion.toLowerCase() === 'heladera') {
      return 'Guardalo en una zona estable de frio y revisa el vencimiento antes de usarlo.';
    }
    if (name.includes('cafe') || name.includes('café')) {
      return 'Conserva el cafe en un lugar fresco y oscuro para mantenerlo mas tiempo.';
    }
    return 'Conservalo en un lugar seco, fresco y lejos de la luz directa.';
  }

  protected daysUntilExpiry(value: string | null | undefined): number {
    if (!value) return Number.POSITIVE_INFINITY;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
  }

  private displayUnit(unit: string | null | undefined): string | null {
    const normalized = unit?.trim();
    if (!normalized) return 'unidad';
    if (normalized.toLowerCase() === 'gr') return 'g';
    if (normalized.toLowerCase() === 'lt') return 'l';
    return normalized;
  }

  private normalizeToken(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private cleanBrand(value: string): string {
    return value.replace(/[^\p{L}\p{N}]+/gu, '').trim() || 'Sin marca';
  }
}
