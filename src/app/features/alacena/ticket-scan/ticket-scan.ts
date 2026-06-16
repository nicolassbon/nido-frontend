import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AlacenaApiService } from '../alacena-api.service';
import { TicketScanService } from '../ticket-scan.service';

interface EditableTicketItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number | null;
}

@Component({
  selector: 'app-ticket-scan',
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './ticket-scan.html',
  styleUrl: './ticket-scan.scss',
})
export class TicketScan {
  private readonly ticketScan = inject(TicketScanService);
  private readonly alacenaApi = inject(AlacenaApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly merchantName = signal<string | null>(null);
  protected readonly items = signal<EditableTicketItem[]>([]);
  protected readonly isScanning = signal(false);
  protected readonly isConfirming = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0),
  );

  protected readonly validItems = computed(() =>
    this.items().filter(item => item.productName.trim().length > 1 && item.quantity > 0),
  );

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Selecciona una imagen del ticket.');
      return;
    }

    const previousUrl = this.previewUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.merchantName.set(null);
    this.items.set([]);
    this.errorMessage.set(null);
  }

  protected scanTicket(): void {
    const file = this.selectedFile();
    if (!file || this.isScanning()) return;

    this.isScanning.set(true);
    this.errorMessage.set(null);

    this.ticketScan.scan(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.merchantName.set(result.merchantName);
          this.items.set(result.items.map(item => ({
            id: crypto.randomUUID(),
            productName: item.productName,
            quantity: Math.max(1, item.quantity || 1),
            unitPrice: item.unitPrice,
          })));
          this.isScanning.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo escanear el ticket. Proba con otra foto o intenta nuevamente.');
          this.isScanning.set(false);
        },
      });
  }

  protected addItem(): void {
    this.items.update(items => [
      ...items,
      { id: crypto.randomUUID(), productName: '', quantity: 1, unitPrice: null },
    ]);
  }

  protected removeItem(id: string): void {
    this.items.update(items => items.filter(item => item.id !== id));
  }

  protected updateItem<K extends keyof Omit<EditableTicketItem, 'id'>>(
    id: string,
    field: K,
    value: EditableTicketItem[K],
  ): void {
    this.items.update(items =>
      items.map(item => item.id === id ? { ...item, [field]: value } : item),
    );
  }

  protected confirmLoad(): void {
    const items = this.validItems();
    if (items.length === 0 || this.isConfirming()) {
      this.errorMessage.set('Agrega al menos un producto valido para confirmar.');
      return;
    }

    this.isConfirming.set(true);
    this.errorMessage.set(null);

    forkJoin(items.map(item => this.alacenaApi.createStock({
      nombre: item.productName.trim(),
      codigoBarras: null,
      imagen: null,
      ubicacion: 'Alacena',
      cantidad: item.quantity,
      unidadMedida: 'unidad',
      fechaVencimiento: null,
      estaAbierto: false,
      porcentajeConsumido: 0,
    })))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/alacena']),
        error: () => {
          this.errorMessage.set('No se pudieron cargar los productos en la alacena.');
          this.isConfirming.set(false);
        },
      });
  }

  protected formatMoney(value: number | null): string {
    if (value === null || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(value);
  }
}
