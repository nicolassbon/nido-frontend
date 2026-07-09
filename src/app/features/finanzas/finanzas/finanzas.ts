import {
  Component,
  computed,
  signal,
  inject,
  viewChild,
  ElementRef,
  effect,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  DoughnutController,
  ArcElement,
  Tooltip,
} from 'chart.js';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { HogaresApiService, MiembroResponse } from '../../household/hogares-api.service';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import {
  FinanzasApiService,
  GastoResponse,
  FacturaResponse,
  BalanceMiembroResponse,
  BalanceResponse,
  DeudaResponse,
  CreateGastoRequest,
  UpdateGastoRequest,
  CreateFacturaRequest,
  SavingsPotencialResponse,
  InsightsListResponse,
  AlacenaOportunidadesResponse,
  PresupuestoResponse,
} from '../finanzas-api.service';
import { NidoDatepickerComponent } from '../../../shared/ui/form/nido-datepicker/nido-datepicker';

Chart.register(
  LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler,
  DoughnutController, ArcElement, Tooltip,
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface NuevoGastoForm {
  monto: number | null;
  descripcion: string;
  categoria: string;
  fecha: string;
  pagadoPorId: string;
  esCompartido: boolean;
  participantesIds: string[]; // vacío = todos los miembros del hogar
}

interface NuevaFacturaForm {
  nombre: string;
  tipo: string;
  monto: number | null;
  fechaVencimiento: string;
  archivo: File | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function firstDayOfMonth(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function lastDayOfMonth(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function firstDayOfPrevMonth(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

function lastDayOfPrevMonth(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 0));
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

const CATEGORY_COLORS: Record<string, string> = {
  Comida:      '#2B4A47',
  Transporte:  '#4a7c59',
  Servicios:   '#B48B6A',
  Otros:       '#d4c5b0',
};

const CATEGORIAS = ['Comida', 'Transporte', 'Servicios', 'Otros'];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function emptyGastoForm(): NuevoGastoForm {
  return { monto: null, descripcion: '', categoria: '', fecha: toIsoDate(new Date()), pagadoPorId: '', esCompartido: true, participantesIds: [] };
}

function emptyFacturaForm(): NuevaFacturaForm {
  return { nombre: '', tipo: 'servicio', monto: null, fechaVencimiento: '', archivo: null };
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-finanzas',
  imports: [LucideAngularModule, FormsModule, NidoDatepickerComponent, Avatar],
  templateUrl: './finanzas.html',
})
export class Finanzas {
  private readonly authService = inject(AuthService);
  private readonly hogaresApi  = inject(HogaresApiService);
  private readonly finanzasApi = inject(FinanzasApiService);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly router      = inject(Router);

  // ── Canvas refs ───────────────────────────────────────
  private readonly lineCanvasRef  = viewChild<ElementRef<HTMLCanvasElement>>('lineCanvas');
  private readonly donutCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('donutCanvas');
  private lineChart?: Chart;
  private donutChart?: Chart;

  // ── Auth ──────────────────────────────────────────────
  protected readonly nombre       = this.authService.getNombre() ?? '';
  private   readonly currentUserId = this.authService.getUserId() ?? '';

  // ── UI state ──────────────────────────────────────────
  protected readonly isLoading            = signal(true);
  protected readonly showGastoModal       = signal(false);
  protected readonly showFacturaModal     = signal(false);
  protected readonly showPresupuestoModal = signal(false);
  protected readonly isSavingGasto        = signal(false);
  protected readonly isSavingFactura      = signal(false);
  protected readonly isSavingPresupuesto  = signal(false);
  protected readonly gastoError           = signal<string | null>(null);
  protected readonly facturaError         = signal<string | null>(null);
  protected readonly presupuestoError     = signal<string | null>(null);
  protected readonly gastoSubmitted       = signal(false);
  protected readonly facturaSubmitted     = signal(false);
  protected readonly editingGasto         = signal<GastoResponse | null>(null);

  // ── Data ──────────────────────────────────────────────
  protected readonly gastosMesActual   = signal<GastoResponse[]>([]);
  protected readonly gastosMesAnterior = signal<GastoResponse[]>([]);
  protected readonly facturas          = signal<FacturaResponse[]>([]);
  protected readonly balance           = signal<BalanceResponse | null>(null);
  protected readonly miembros          = signal<MiembroResponse[]>([]);
  protected readonly modoAhorro              = signal(false);
  protected readonly modoAhorroLoading       = signal(false);
  protected readonly savingsPotencial        = signal<SavingsPotencialResponse | null>(null);
  protected readonly insights                = signal<InsightsListResponse | null>(null);
  protected readonly alacenaOportunidades    = signal<AlacenaOportunidadesResponse | null>(null);
  protected readonly totalMesActual    = signal(0);
  protected readonly totalMesAnterior  = signal(0);
  protected readonly presupuesto       = signal<PresupuestoResponse | null>(null);

  // ── Forms ─────────────────────────────────────────────
  protected gastoForm        = emptyGastoForm();
  protected facturaForm      = emptyFacturaForm();
  protected presupuestoMonto: number | null = null;

  // ── Constants ────────────────────────────────────────
  protected readonly categorias = CATEGORIAS;

  // ── Computed ──────────────────────────────────────────
  protected readonly pctVsMesAnterior = computed(() => {
    const prev = this.totalMesAnterior();
    if (prev === 0) return null;
    return Math.round(((this.totalMesActual() - prev) / prev) * 100);
  });

  protected readonly gastosPorCategoria = computed(() => {
    const totals: Record<string, number> = {};
    for (const g of this.gastosMesActual()) {
      const cat = g.categoria ?? 'Otros';
      totals[cat] = (totals[cat] ?? 0) + g.monto;
    }
    return totals;
  });

  protected readonly facturasActivas = computed(() =>
    this.facturas().filter(f => !f.pagada)
  );

  protected readonly balanceMiembros = computed(() => this.balance()?.miembros ?? []);
  protected readonly deudas          = computed(() => this.balance()?.deudas ?? []);
  protected readonly totalPersonal   = computed(() => this.balance()?.totalPersonal ?? 0);

  protected readonly todosMiembros = computed(() => this.miembros());

  protected readonly gastoFormValid = computed(() =>
    (this.gastoForm.monto ?? 0) > 0 && !!this.gastoForm.fecha
  );

  protected readonly facturaFormValid = computed(() =>
    this.facturaForm.nombre.trim().length > 0 && !!this.facturaForm.tipo
  );

  // ── Chart computed data ───────────────────────────────
  private readonly lineData = computed(() => {
    const byDay: Record<string, number> = {};
    for (const g of this.gastosMesActual()) {
      byDay[g.fecha] = (byDay[g.fecha] ?? 0) + g.monto;
    }
    const labels = Object.keys(byDay).sort();
    return { labels, values: labels.map(l => byDay[l]) };
  });

  private readonly donutData = computed(() => {
    const byCat = this.gastosPorCategoria();
    const labels = Object.keys(byCat);
    return {
      labels,
      values: labels.map(l => byCat[l]),
      colors: labels.map(l => CATEGORY_COLORS[l] ?? '#ccc5bb'),
    };
  });

  constructor() {
    // React when the line chart canvas appears or data changes
    effect(() => {
      const canvas = this.lineCanvasRef();
      const { labels, values } = this.lineData();
      if (!canvas) return;
      this.renderLineChart(canvas.nativeElement, labels, values);
    });

    // React when the donut canvas appears or category data changes
    effect(() => {
      const canvas = this.donutCanvasRef();
      const { labels, values, colors } = this.donutData();
      if (!canvas) return;
      this.renderDonutChart(canvas.nativeElement, labels, values, colors);
    });

    this.destroyRef.onDestroy(() => {
      this.lineChart?.destroy();
      this.donutChart?.destroy();
    });

    this.loadAll();
  }

  private loadAll(): void {
    const now = new Date();

    forkJoin({
      gastosMes:   this.finanzasApi.getGastos(firstDayOfMonth(now), lastDayOfMonth(now)),
      gastosPrev:  this.finanzasApi.getGastos(firstDayOfPrevMonth(now), lastDayOfPrevMonth(now)),
      balance:     this.finanzasApi.getBalance(firstDayOfMonth(now), lastDayOfMonth(now)),
      modoAhorro:  this.finanzasApi.getModoAhorro(),
      miembros:    this.hogaresApi.getMiembros(),
      facturas:    this.finanzasApi.getFacturas(),
      presupuesto: this.finanzasApi.getPresupuesto(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ gastosMes, gastosPrev, balance, modoAhorro, miembros, facturas, presupuesto }) => {
          this.gastosMesActual.set(gastosMes.gastos);
          this.totalMesActual.set(gastosMes.totalPeriodo);
          this.gastosMesAnterior.set(gastosPrev.gastos);
          this.totalMesAnterior.set(gastosPrev.totalPeriodo);
          this.balance.set(balance);
          this.modoAhorro.set(modoAhorro.activo);
          this.miembros.set(miembros);
          this.facturas.set(facturas);
          this.presupuesto.set(presupuesto.monto !== null ? presupuesto : null);
          this.isLoading.set(false);
          if (modoAhorro.activo) this.loadModoAhorroData();
        },
        error: () => this.isLoading.set(false),
      });
  }

  // ── Chart rendering ───────────────────────────────────

  private renderLineChart(canvas: HTMLCanvasElement, labels: string[], values: number[]): void {
    this.lineChart?.destroy();
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(43,74,71,0.30)');
    gradient.addColorStop(1, 'rgba(43,74,71,0)');

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.map(l => l.slice(8)),
        datasets: [{
          data: values,
          borderColor: '#2B4A47',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2B4A47',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => formatMoney(ctx.parsed.y ?? 0) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#927357', font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#927357', font: { size: 11 }, callback: v => `$${(Number(v) / 1000).toFixed(0)}k` },
          },
        },
      },
    });
  }

  private renderDonutChart(canvas: HTMLCanvasElement, labels: string[], values: number[], colors: string[]): void {
    this.donutChart?.destroy();
    if (values.length === 0) return;

    this.donutChart = new Chart(canvas.getContext('2d')!, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#FDFAF6' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatMoney(Number(ctx.raw))}` } },
        },
      },
    });
  }

  // ── Balance refresh ───────────────────────────────────

  private refreshBalance(ref: Date): void {
    this.finanzasApi.getBalance(firstDayOfMonth(ref), lastDayOfMonth(ref))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: b => this.balance.set(b) });
  }

  // ── Modo ahorro ───────────────────────────────────────

  protected toggleModoAhorro(): void {
    const nuevo = !this.modoAhorro();
    this.finanzasApi.setModoAhorro(nuevo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.modoAhorro.set(r.activo);
          if (r.activo) {
            this.loadModoAhorroData();
          } else {
            this.savingsPotencial.set(null);
            this.insights.set(null);
            this.alacenaOportunidades.set(null);
          }
        },
      });
  }

  private loadModoAhorroData(): void {
    this.modoAhorroLoading.set(true);
    forkJoin({
      potencial: this.finanzasApi.getSavingsPotencial(),
      insights:  this.finanzasApi.getInsights(),
      alacena:   this.finanzasApi.getAlacenaOportunidades(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ potencial, insights, alacena }) => {
          this.savingsPotencial.set(potencial);
          this.insights.set(insights);
          this.alacenaOportunidades.set(alacena);
          this.modoAhorroLoading.set(false);
        },
        error: () => this.modoAhorroLoading.set(false),
      });
  }

  // ── Nuevo gasto ───────────────────────────────────────

  protected openGastoModal(): void {
    this.gastoForm = emptyGastoForm();
    this.gastoError.set(null);
    this.gastoSubmitted.set(false);
    this.showGastoModal.set(true);
  }

  protected closeGastoModal(): void {
    this.showGastoModal.set(false);
    this.editingGasto.set(null);
  }

  protected submitGasto(): void {
    this.gastoSubmitted.set(true);
    if (!this.gastoFormValid()) return;

    this.isSavingGasto.set(true);
    this.gastoError.set(null);

    const now = new Date();
    const editing = this.editingGasto();

    if (editing) {
      const req: UpdateGastoRequest = {
        monto:            this.gastoForm.monto!,
        descripcion:      this.gastoForm.descripcion || null,
        categoria:        this.gastoForm.categoria || null,
        fecha:            this.gastoForm.fecha,
        pagadoPorId:      this.gastoForm.pagadoPorId || null,
        esCompartido:     this.gastoForm.esCompartido,
        participantesIds: this.gastoForm.esCompartido && this.gastoForm.participantesIds.length > 0
          ? this.gastoForm.participantesIds
          : null,
      };

      this.finanzasApi.updateGasto(editing.id, req)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: gasto => {
            this.gastosMesActual.update(list => list.map(g => g.id === gasto.id ? gasto : g));

            const oldInMonth = editing.fecha >= firstDayOfMonth(now) && editing.fecha <= lastDayOfMonth(now);
            const newInMonth = gasto.fecha >= firstDayOfMonth(now) && gasto.fecha <= lastDayOfMonth(now);
            const montoDiff = (newInMonth ? gasto.monto : 0) - (oldInMonth ? editing.monto : 0);

            if (montoDiff !== 0) {
              this.totalMesActual.update(t => t + montoDiff);
              this.presupuesto.update(p => {
                if (!p || p.monto === null) return p;
                const nuevoGasto = p.gastoActual + montoDiff;
                return { ...p, gastoActual: nuevoGasto, restante: Math.round((p.monto - nuevoGasto) * 100) / 100 };
              });
            }

            this.isSavingGasto.set(false);
            this.showGastoModal.set(false);
            this.editingGasto.set(null);
            this.refreshBalance(now);
          },
          error: () => {
            this.gastoError.set('No se pudo guardar el gasto. Verificá los datos.');
            this.isSavingGasto.set(false);
          },
        });
    } else {
      const req: CreateGastoRequest = {
        monto:            this.gastoForm.monto!,
        descripcion:      this.gastoForm.descripcion || null,
        categoria:        this.gastoForm.categoria || null,
        fecha:            this.gastoForm.fecha,
        pagadoPorId:      this.gastoForm.pagadoPorId || null,
        esCompartido:     this.gastoForm.esCompartido,
        participantesIds: this.gastoForm.esCompartido && this.gastoForm.participantesIds.length > 0
          ? this.gastoForm.participantesIds
          : null,
      };

      this.finanzasApi.createGasto(req)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: gasto => {
            this.gastosMesActual.update(list => [gasto, ...list]);
            if (gasto.fecha >= firstDayOfMonth(now) && gasto.fecha <= lastDayOfMonth(now)) {
              this.totalMesActual.update(t => t + gasto.monto);
              this.presupuesto.update(p => {
                if (!p || p.monto === null) return p;
                const nuevoGasto = p.gastoActual + gasto.monto;
                return { ...p, gastoActual: nuevoGasto, restante: Math.round((p.monto - nuevoGasto) * 100) / 100 };
              });
            }
            this.isSavingGasto.set(false);
            this.showGastoModal.set(false);
            this.refreshBalance(now);
            if (this.modoAhorro()) this.loadModoAhorroData();
          },
          error: () => {
            this.gastoError.set('No se pudo guardar el gasto. Verificá los datos.');
            this.isSavingGasto.set(false);
          },
        });
    }
  }

  // ── Editar / eliminar gasto ───────────────────────────

  protected openEditGastoModal(gasto: GastoResponse): void {
    this.editingGasto.set(gasto);
    this.gastoForm = {
      monto:            gasto.monto,
      descripcion:      gasto.descripcion ?? '',
      categoria:        gasto.categoria ?? '',
      fecha:            gasto.fecha,
      pagadoPorId:      gasto.pagadoPorId,
      esCompartido:     gasto.esCompartido,
      participantesIds: gasto.participantesIds ?? [],
    };
    this.gastoError.set(null);
    this.gastoSubmitted.set(false);
    this.showGastoModal.set(true);
  }

  protected deleteGasto(gasto: GastoResponse): void {
    const now = new Date();
    const inCurrentMonth = gasto.fecha >= firstDayOfMonth(now) && gasto.fecha <= lastDayOfMonth(now);

    this.finanzasApi.deleteGasto(gasto.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.gastosMesActual.update(list => list.filter(g => g.id !== gasto.id));

          if (inCurrentMonth) {
            this.totalMesActual.update(t => Math.max(0, t - gasto.monto));
            this.presupuesto.update(p => {
              if (!p || p.monto === null) return p;
              const nuevoGasto = p.gastoActual - gasto.monto;
              return { ...p, gastoActual: nuevoGasto, restante: Math.round((p.monto - nuevoGasto) * 100) / 100 };
            });
          }

          if (result.facturaRevertida && result.facturaId) {
            this.facturas.update(list =>
              list.map(f => f.id === result.facturaId ? { ...f, pagada: false } : f)
            );
          }

          this.refreshBalance(now);
        },
      });
  }

  // ── Nueva factura ─────────────────────────────────────

  protected openFacturaModal(): void {
    this.facturaForm = emptyFacturaForm();
    this.facturaError.set(null);
    this.facturaSubmitted.set(false);
    this.showFacturaModal.set(true);
  }

  protected closeFacturaModal(): void { this.showFacturaModal.set(false); }

  protected onArchivoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.facturaForm = { ...this.facturaForm, archivo: file };
  }

  protected submitFactura(): void {
    this.facturaSubmitted.set(true);
    if (!this.facturaFormValid()) return;

    this.isSavingFactura.set(true);
    this.facturaError.set(null);

    const req: CreateFacturaRequest = {
      nombre:           this.facturaForm.nombre.trim(),
      tipo:             this.facturaForm.tipo,
      monto:            this.facturaForm.monto,
      fechaVencimiento: this.facturaForm.fechaVencimiento || null,
      archivo:          this.facturaForm.archivo,
    };

    this.finanzasApi.createFactura(req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: factura => {
          this.facturas.update(list => [...list, factura]);
          this.isSavingFactura.set(false);
          this.showFacturaModal.set(false);
        },
        error: () => {
          this.facturaError.set('No se pudo guardar la factura. Verificá los datos.');
          this.isSavingFactura.set(false);
        },
      });
  }

  // ── Factura actions ───────────────────────────────────

  protected marcarPagada(id: string): void {
    const now = new Date();
    this.finanzasApi.marcarPagada(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: result => {
        this.facturas.update(list => list.map(f => f.id === id ? result.factura : f));
        if (result.gastoCreado) {
          this.gastosMesActual.update(list => [result.gastoCreado!, ...list]);
          this.totalMesActual.update(t => t + result.gastoCreado!.monto);
          this.presupuesto.update(p => {
            if (!p || p.monto === null) return p;
            const nuevoGasto = p.gastoActual + result.gastoCreado!.monto;
            return { ...p, gastoActual: nuevoGasto, restante: Math.round((p.monto - nuevoGasto) * 100) / 100 };
          });
          this.refreshBalance(now);
        }
      }});
  }

  protected deleteFactura(id: string): void {
    this.finanzasApi.deleteFactura(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => {
        this.facturas.update(list => list.filter(f => f.id !== id));
      }});
  }

  // ── Presupuesto ───────────────────────────────────────

  protected openPresupuestoModal(): void {
    this.presupuestoMonto = this.presupuesto()?.monto ?? null;
    this.presupuestoError.set(null);
    this.showPresupuestoModal.set(true);
  }

  protected closePresupuestoModal(): void { this.showPresupuestoModal.set(false); }

  protected submitPresupuesto(): void {
    const monto = this.presupuestoMonto;
    if (!monto || monto <= 0) {
      this.presupuestoError.set('Ingresá un monto mayor a 0.');
      return;
    }

    this.isSavingPresupuesto.set(true);
    this.presupuestoError.set(null);

    this.finanzasApi.setPresupuesto(monto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.presupuesto.set(result);
          this.isSavingPresupuesto.set(false);
          this.showPresupuestoModal.set(false);
        },
        error: () => {
          this.presupuestoError.set('No se pudo guardar el presupuesto.');
          this.isSavingPresupuesto.set(false);
        },
      });
  }

  // ── Participantes del gasto ───────────────────────────

  protected isParticipante(usuarioId: string): boolean {
    // Lista vacía = todos participan
    return this.gastoForm.participantesIds.length === 0
      || this.gastoForm.participantesIds.includes(usuarioId);
  }

  protected toggleParticipante(usuarioId: string): void {
    const ids = this.gastoForm.participantesIds;
    const todos = this.todosMiembros().map(m => m.usuarioId);

    // Si está vacío (todos), expandir a todos menos este
    if (ids.length === 0) {
      this.gastoForm = { ...this.gastoForm, participantesIds: todos.filter(id => id !== usuarioId) };
      return;
    }

    const yaTiene = ids.includes(usuarioId);
    let nuevos = yaTiene ? ids.filter(id => id !== usuarioId) : [...ids, usuarioId];

    // Si quedan todos seleccionados → colapsar a lista vacía (= todos)
    if (nuevos.length === todos.length) nuevos = [];

    this.gastoForm = { ...this.gastoForm, participantesIds: nuevos };
  }

  protected get participantesLabel(): string {
    const ids = this.gastoForm.participantesIds;
    if (ids.length === 0) return 'Todo el hogar';
    const nombres = this.todosMiembros()
      .filter(m => ids.includes(m.usuarioId))
      .map(m => m.nombre.split(' ')[0]);
    return nombres.join(', ');
  }

  // ── Balance helpers ───────────────────────────────────

  protected balanceEstado(): 'vacio' | 'equilibrado' | 'deudas' {
    const b = this.balance();
    if (!b || b.totalPeriodo === 0) return 'vacio';
    if (b.deudas.length === 0) return 'equilibrado';
    return 'deudas';
  }

  protected esMiDeuda(deuda: DeudaResponse): boolean {
    return deuda.deudorId === this.currentUserId;
  }

  protected esMiAcreencia(deuda: DeudaResponse): boolean {
    return deuda.acreedorId === this.currentUserId;
  }

  // ── Display helpers ───────────────────────────────────

  protected readonly formatMoney = formatMoney;
  protected absPct(n: number): number { return Math.abs(n); }

  protected formatFecha(fecha: string): string {
    const parts = fecha.split('-');
    const m = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${MESES[m]}`;
  }

  protected diasParaVencerLabel(dias: number | null): string {
    if (dias === null) return '';
    if (dias < 0)  return 'Vencida';
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Vence en ${dias} días`;
  }

  protected diasColor(dias: number | null): string {
    if (dias === null) return 'text-nido-muted';
    if (dias <= 0) return 'text-red-500';
    if (dias <= 3) return 'text-red-400';
    if (dias <= 7) return 'text-amber-500';
    return 'text-nido-muted';
  }

  protected catColor(cat: string | null): string {
    return CATEGORY_COLORS[cat ?? ''] ?? '#d4c5b0';
  }

  protected catKeys(): string[] {
    return Object.keys(this.gastosPorCategoria());
  }

  protected pctCategoria(cat: string): number {
    const total = this.totalMesActual();
    if (total === 0) return 0;
    return Math.round((this.gastosPorCategoria()[cat] / total) * 100);
  }

  protected balanceLabel(n: number): string {
    if (n > 0) return `+${formatMoney(n)}`;
    return formatMoney(n);
  }

  protected balanceColor(n: number): string {
    return n >= 0 ? 'text-emerald-600' : 'text-red-500';
  }

  protected ubicacionColor(ubicacion: string): string {
    const map: Record<string, string> = {
      Alacena:  '#B48B6A',
      Freezer:  '#3E5E4A',
      Heladera: '#927357',
    };
    return map[ubicacion] ?? '#9a806c';
  }

  protected diasVencerLabel(dias: number | null): string {
    if (dias === null) return '';
    if (dias < 0)  return 'Vencido';
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `Vence en ${dias} días`;
  }

  protected diasVencerUrgente(dias: number | null): boolean {
    return dias !== null && dias <= 3;
  }

  protected potencialBarWidth(potencial: number, totalPotencial: number): number {
    if (totalPotencial === 0) return 0;
    return Math.round((potencial / totalPotencial) * 100);
  }

  protected insightBorderColor(tipo: string): string {
    if (tipo === 'alerta')    return '#b44c3c';
    if (tipo === 'tendencia') return '#B48B6A';
    return '#4a7c59';
  }

  protected navegarAEscanear(): void {
    void this.router.navigate(['/alacena/escanear-ticket'], { queryParams: { returnTo: 'finanzas' } });
  }
}
