import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlacenaApiService,
  NutritionInfoItemResponse,
  NutritionInfoResponse,
  SaveNutritionInfoRequest,
} from '../alacena-api.service';

interface EditableNutritionItem {
  id: string;
  nombre: string;
  valor: number | null;
  unidad: string | null;
  porcentajeDiario: number | null;
  orden: number;
}

@Component({
  selector: 'app-nutrition-scan',
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './nutrition-scan.html',
  styleUrl: './nutrition-scan.scss',
})
export class NutritionScan {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alacenaApi = inject(AlacenaApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stockId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly isScanning = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly porcion = signal<string | null>(null);
  protected readonly base = signal<string | null>(null);
  protected readonly items = signal<EditableNutritionItem[]>([]);

  protected readonly validItems = computed(() =>
    this.items().filter(item => item.nombre.trim().length > 1),
  );

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.stockId.set(params.get('id'));
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Selecciona una imagen de la etiqueta nutricional.');
      return;
    }

    const previousUrl = this.previewUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.items.set([]);
    this.porcion.set(null);
    this.base.set(null);
    this.errorMessage.set(null);
  }

  protected scanNutrition(): void {
    const stockId = this.stockId();
    const file = this.selectedFile();
    if (!stockId || !file || this.isScanning()) return;

    this.isScanning.set(true);
    this.errorMessage.set(null);

    this.alacenaApi.scanNutritionInfo(stockId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.applyResult(result);
          this.isScanning.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo escanear la información nutricional. Probá con otra foto o cargá los datos manualmente.');
          this.isScanning.set(false);
        },
      });
  }

  protected addItem(): void {
    this.items.update(items => [
      ...items,
      {
        id: crypto.randomUUID(),
        nombre: '',
        valor: null,
        unidad: 'g',
        porcentajeDiario: null,
        orden: items.length + 1,
      },
    ]);
  }

  protected removeItem(id: string): void {
    this.items.update(items => items.filter(item => item.id !== id));
  }

  protected updateItem<K extends keyof Omit<EditableNutritionItem, 'id'>>(
    id: string,
    field: K,
    value: EditableNutritionItem[K],
  ): void {
    this.items.update(items =>
      items.map(item => item.id === id ? { ...item, [field]: value } : item),
    );
  }

  protected saveNutrition(): void {
    const stockId = this.stockId();
    if (!stockId || this.isSaving()) return;

    const items = this.validItems();
    if (items.length === 0) {
      this.errorMessage.set('Agregá al menos un nutriente para guardar.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.alacenaApi.saveNutritionInfo(stockId, this.toSaveRequest(items))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/alacena', stockId]),
        error: () => {
          this.errorMessage.set('No se pudo guardar la información nutricional.');
          this.isSaving.set(false);
        },
      });
  }

  protected formatValue(item: EditableNutritionItem): string {
    if (item.valor === null || item.valor === undefined) return '-';
    const value = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(item.valor);
    return `${value}${item.unidad ? ` ${item.unidad}` : ''}`;
  }

  protected setPorcion(value: string): void {
    this.porcion.set(value.trim() ? value : null);
  }

  protected setBase(value: string): void {
    this.base.set(value.trim() ? value : null);
  }

  private applyResult(result: NutritionInfoResponse): void {
    this.porcion.set(result.porcion);
    this.base.set(result.base);
    this.items.set(this.withPrincipalFallbacks(result).map((item, index) => ({
      id: crypto.randomUUID(),
      nombre: item.nombre,
      valor: item.valor,
      unidad: item.unidad,
      porcentajeDiario: item.porcentajeDiario,
      orden: item.orden || index + 1,
    })));
  }

  private withPrincipalFallbacks(result: NutritionInfoResponse): NutritionInfoItemResponse[] {
    const items = [...result.items];
    this.ensurePrincipal(items, 'Valor energetico', result.calorias, 'kcal');
    this.ensurePrincipal(items, 'Carbohidratos', result.carbohidratos, 'g');
    this.ensurePrincipal(items, 'Proteinas', result.proteinas, 'g');
    this.ensurePrincipal(items, 'Grasas', result.grasas, 'g');
    return items.sort((a, b) => a.orden - b.orden);
  }

  private ensurePrincipal(
    items: NutritionInfoItemResponse[],
    nombre: string,
    valor: number | null,
    unidad: string,
  ): void {
    if (valor === null || valor === undefined) return;
    if (items.some(item => this.normalize(item.nombre) === this.normalize(nombre))) return;
    items.push({ nombre, valor, unidad, porcentajeDiario: null, orden: items.length + 1 });
  }

  private toSaveRequest(items: EditableNutritionItem[]): SaveNutritionInfoRequest {
    return {
      calorias: this.findValue(items, 'Valor energetico'),
      proteinas: this.findValue(items, 'Proteinas'),
      carbohidratos: this.findValue(items, 'Carbohidratos'),
      grasas: this.findValue(items, 'Grasas'),
      porcion: this.porcion(),
      base: this.base(),
      items: items.map((item, index) => ({
        nombre: item.nombre.trim(),
        valor: item.valor,
        unidad: item.unidad?.trim() || null,
        porcentajeDiario: item.porcentajeDiario,
        orden: item.orden || index + 1,
      })),
    };
  }

  private findValue(items: EditableNutritionItem[], name: string): number | null {
    return items.find(item => this.normalize(item.nombre) === this.normalize(name))?.valor ?? null;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}

