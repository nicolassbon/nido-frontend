import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { appConfig } from '../../../app.config';
import { Finanzas } from './finanzas';
import { GastoResponse, FacturaResponse } from '../finanzas-api.service';

describe('Finanzas', () => {
  let component: Finanzas;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Finanzas],
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(Finanzas);
    component = fixture.componentInstance;
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  // ── pctVsMesAnterior ──────────────────────────────────────────────────────

  it('pctVsMesAnterior devuelve null cuando el mes anterior es cero', () => {
    component['totalMesAnterior'].set(0);
    component['totalMesActual'].set(1000);

    expect(component['pctVsMesAnterior']()).toBeNull();
  });

  it('pctVsMesAnterior calcula correctamente un aumento positivo', () => {
    component['totalMesAnterior'].set(1000);
    component['totalMesActual'].set(1200);

    expect(component['pctVsMesAnterior']()).toBe(20);
  });

  it('pctVsMesAnterior calcula correctamente una baja negativa', () => {
    component['totalMesAnterior'].set(1000);
    component['totalMesActual'].set(700);

    expect(component['pctVsMesAnterior']()).toBe(-30);
  });

  // ── gastosPorCategoria ────────────────────────────────────────────────────

  it('gastosPorCategoria agrupa y suma los montos por categoría', () => {
    component['gastosMesActual'].set([
      makeGasto(1000, 'Comida'),
      makeGasto(500,  'Comida'),
      makeGasto(300,  'Transporte'),
    ]);

    const result = component['gastosPorCategoria']();
    expect(result['Comida']).toBe(1500);
    expect(result['Transporte']).toBe(300);
  });

  it('gastosPorCategoria asigna categoría null a Otros', () => {
    component['gastosMesActual'].set([makeGasto(200, null)]);

    const result = component['gastosPorCategoria']();
    expect(result['Otros']).toBe(200);
  });

  // ── facturasActivas ───────────────────────────────────────────────────────

  it('facturasActivas filtra las facturas ya pagadas', () => {
    component['facturas'].set([
      makeFactura('f1', false),
      makeFactura('f2', true),
      makeFactura('f3', false),
    ]);

    const activas = component['facturasActivas']();
    expect(activas.length).toBe(2);
    expect(activas.map(f => f.id)).toEqual(['f1', 'f3']);
  });

  // ── gastoFormValid ────────────────────────────────────────────────────────

  it('gastoFormValid es false cuando el monto es null', () => {
    component['gastoForm'] = { monto: null, descripcion: '', categoria: '', fecha: '2026-01-15', pagadoPorId: '' };

    expect(component['gastoFormValid']()).toBe(false);
  });

  it('gastoFormValid es false cuando el monto es cero', () => {
    component['gastoForm'] = { monto: 0, descripcion: '', categoria: '', fecha: '2026-01-15', pagadoPorId: '' };

    expect(component['gastoFormValid']()).toBe(false);
  });

  it('gastoFormValid es true cuando el monto es mayor a cero y hay fecha', () => {
    component['gastoForm'] = { monto: 100, descripcion: '', categoria: '', fecha: '2026-01-15', pagadoPorId: '' };

    expect(component['gastoFormValid']()).toBe(true);
  });

  // ── facturaFormValid ──────────────────────────────────────────────────────

  it('facturaFormValid es false cuando el nombre está vacío', () => {
    component['facturaForm'] = { nombre: '', tipo: 'servicio', monto: null, fechaVencimiento: '', archivo: null };

    expect(component['facturaFormValid']()).toBe(false);
  });

  it('facturaFormValid es true cuando nombre y tipo están completos', () => {
    component['facturaForm'] = { nombre: 'Internet', tipo: 'servicio', monto: null, fechaVencimiento: '', archivo: null };

    expect(component['facturaFormValid']()).toBe(true);
  });

  // ── diasParaVencerLabel ───────────────────────────────────────────────────

  it('diasParaVencerLabel devuelve cadena vacía para null', () => {
    expect(component['diasParaVencerLabel'](null)).toBe('');
  });

  it('diasParaVencerLabel devuelve "Vencida" para días negativos', () => {
    expect(component['diasParaVencerLabel'](-1)).toBe('Vencida');
  });

  it('diasParaVencerLabel devuelve "Vence hoy" para cero días', () => {
    expect(component['diasParaVencerLabel'](0)).toBe('Vence hoy');
  });

  it('diasParaVencerLabel devuelve "Vence mañana" para un día', () => {
    expect(component['diasParaVencerLabel'](1)).toBe('Vence mañana');
  });

  it('diasParaVencerLabel devuelve el texto con días cuando son varios', () => {
    expect(component['diasParaVencerLabel'](5)).toBe('Vence en 5 días');
  });

  // ── diasColor ─────────────────────────────────────────────────────────────

  it('diasColor devuelve muted para null', () => {
    expect(component['diasColor'](null)).toBe('text-nido-muted');
  });

  it('diasColor devuelve rojo fuerte para facturas vencidas', () => {
    expect(component['diasColor'](-1)).toBe('text-red-500');
    expect(component['diasColor'](0)).toBe('text-red-500');
  });

  it('diasColor devuelve rojo suave para 1 a 3 días', () => {
    expect(component['diasColor'](3)).toBe('text-red-400');
  });

  it('diasColor devuelve ámbar para 4 a 7 días', () => {
    expect(component['diasColor'](7)).toBe('text-amber-500');
  });

  it('diasColor devuelve muted para más de 7 días', () => {
    expect(component['diasColor'](10)).toBe('text-nido-muted');
  });

  // ── balanceLabel ──────────────────────────────────────────────────────────

  it('balanceLabel antepone + para balance positivo', () => {
    expect(component['balanceLabel'](1000)).toContain('+');
  });

  it('balanceLabel no antepone + para balance negativo', () => {
    const label = component['balanceLabel'](-500);
    expect(label).not.toContain('++');
  });

  // ── balanceColor ──────────────────────────────────────────────────────────

  it('balanceColor devuelve verde para balance positivo', () => {
    expect(component['balanceColor'](100)).toBe('text-emerald-600');
  });

  it('balanceColor devuelve verde para balance en cero', () => {
    expect(component['balanceColor'](0)).toBe('text-emerald-600');
  });

  it('balanceColor devuelve rojo para balance negativo', () => {
    expect(component['balanceColor'](-100)).toBe('text-red-500');
  });

  // ── potencialBarWidth ─────────────────────────────────────────────────────

  it('potencialBarWidth devuelve 0 cuando el total es cero', () => {
    expect(component['potencialBarWidth'](500, 0)).toBe(0);
  });

  it('potencialBarWidth calcula el porcentaje correcto', () => {
    expect(component['potencialBarWidth'](500, 1000)).toBe(50);
  });

  it('potencialBarWidth devuelve 100 cuando el potencial iguala al total', () => {
    expect(component['potencialBarWidth'](1000, 1000)).toBe(100);
  });

  // ── insightBorderColor ────────────────────────────────────────────────────

  it('insightBorderColor devuelve rojo para alertas', () => {
    expect(component['insightBorderColor']('alerta')).toBe('#b44c3c');
  });

  it('insightBorderColor devuelve ámbar para tendencias', () => {
    expect(component['insightBorderColor']('tendencia')).toBe('#B48B6A');
  });

  it('insightBorderColor devuelve verde para positivos', () => {
    expect(component['insightBorderColor']('positivo')).toBe('#4a7c59');
  });

  // ── pctCategoria ──────────────────────────────────────────────────────────

  it('pctCategoria devuelve 0 cuando el total del mes es cero', () => {
    component['totalMesActual'].set(0);

    expect(component['pctCategoria']('Comida')).toBe(0);
  });

  it('pctCategoria calcula el porcentaje correcto sobre el total', () => {
    component['totalMesActual'].set(1000);
    component['gastosMesActual'].set([
      makeGasto(750, 'Comida'),
      makeGasto(250, 'Transporte'),
    ]);

    expect(component['pctCategoria']('Comida')).toBe(75);
    expect(component['pctCategoria']('Transporte')).toBe(25);
  });

  // ── formatFecha ───────────────────────────────────────────────────────────

  it('formatFecha convierte una fecha ISO a formato "DD mes"', () => {
    expect(component['formatFecha']('2026-01-15')).toBe('15 ene');
    expect(component['formatFecha']('2026-12-31')).toBe('31 dic');
  });

  // ── absPct ────────────────────────────────────────────────────────────────

  it('absPct devuelve el valor absoluto de un número positivo', () => {
    expect(component['absPct'](30)).toBe(30);
  });

  it('absPct devuelve el valor absoluto de un número negativo', () => {
    expect(component['absPct'](-83)).toBe(83);
  });

  // ── openEditGastoModal ────────────────────────────────────────────────────

  it('openEditGastoModal pre-carga el formulario y activa el modo edición', () => {
    const gasto = makeGasto(1500, 'Comida');

    component['openEditGastoModal'](gasto);

    expect(component['editingGasto']()).toEqual(gasto);
    expect(component['gastoForm'].monto).toBe(1500);
    expect(component['gastoForm'].categoria).toBe('Comida');
    expect(component['gastoForm'].pagadoPorId).toBe('u1');
    expect(component['showGastoModal']()).toBe(true);
  });

  it('closeGastoModal limpia el gasto en edición', () => {
    component['editingGasto'].set(makeGasto(500, null));
    component['showGastoModal'].set(true);

    component['closeGastoModal']();

    expect(component['editingGasto']()).toBeNull();
    expect(component['showGastoModal']()).toBe(false);
  });

  // ── openPresupuestoModal ──────────────────────────────────────────────────

  it('openPresupuestoModal deja presupuestoMonto en null cuando no hay presupuesto', () => {
    component['presupuesto'].set(null);

    component['openPresupuestoModal']();

    expect(component['presupuestoMonto']).toBeNull();
    expect(component['showPresupuestoModal']()).toBe(true);
  });

  it('openPresupuestoModal carga el monto del presupuesto existente', () => {
    component['presupuesto'].set({ monto: 5000, gastoActual: 1000, restante: 4000, anio: 2026, mes: 6 });

    component['openPresupuestoModal']();

    expect(component['presupuestoMonto']).toBe(5000);
  });

  // ── closePresupuestoModal ─────────────────────────────────────────────────

  it('closePresupuestoModal cierra el modal de presupuesto', () => {
    component['showPresupuestoModal'].set(true);

    component['closePresupuestoModal']();

    expect(component['showPresupuestoModal']()).toBe(false);
  });
});

// ── Helpers de test ───────────────────────────────────────────────────────────

function makeGasto(monto: number, categoria: string | null): GastoResponse {
  return {
    id: crypto.randomUUID(),
    monto,
    descripcion: null,
    categoria,
    fecha: '2026-01-15',
    pagadoPorId: 'u1',
    pagadoPorNombre: 'Ana',
    createdAt: '',
    facturaId: null,
  };
}

function makeFactura(id: string, pagada: boolean): FacturaResponse {
  return {
    id,
    nombre: 'Luz',
    tipo: 'servicio',
    monto: null,
    fechaVencimiento: null,
    archivoUrl: null,
    pagada,
    diasParaVencer: null,
    creadoPor: 'u1',
    creadoPorNombre: 'Ana',
    createdAt: '',
  };
}
