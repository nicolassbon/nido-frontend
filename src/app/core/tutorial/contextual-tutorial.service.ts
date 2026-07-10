import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, take } from 'rxjs';
import { driver, DriveStep, Driver } from 'driver.js';
import {
  OnboardingApiService,
  TutorialModule,
  TutorialUsuarioState,
} from '../../features/onboarding/onboarding-api.service';

interface TutorialStep {
  selector: string;
  title?: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

interface TutorialDefinition {
  module: TutorialModule;
  paths: string[];
  steps: TutorialStep[];
}

const COMPLETED_FIELD: Record<TutorialModule, keyof TutorialUsuarioState> = {
  home: 'homeCompletado',
  alacena: 'alacenaCompletado',
  recetas: 'recetasCompletado',
  'lista-compras': 'listaComprasCompletado',
  electrodomesticos: 'electrodomesticosCompletado',
  finanzas: 'finanzasCompletado',
  planificador: 'planificadorCompletado',
  tareas: 'tareasCompletado',
  notificaciones: 'notificacionesCompletado',
  perfil: 'perfilCompletado',
  configuracion: 'configuracionCompletado',
};

const TUTORIALS: TutorialDefinition[] = [
  {
    module: 'home',
    paths: ['/inicio'],
    steps: [
      {
        selector: '[data-tour="home-main-actions"]',
        title: 'Bienvenido a Nido',
        description: 'Nido centraliza la gestion completa de tu hogar en un solo lugar. Desde aca podes acceder rapido a las funciones principales.',
        side: 'bottom',
      },
      {
        selector: '[data-tour="home-add-product"]',
        title: 'Agregar producto',
        description: 'Comenza cargando los productos que tenes en tu hogar. Podes agregarlos manualmente, escaneando un codigo de barras o leyendo un ticket.',
      },
      {
        selector: '[data-tour="home-find-recipe"]',
        title: 'Buscar receta',
        description: 'Encontra recetas segun los ingredientes disponibles en tu alacena y las preferencias alimentarias configuradas.',
      },
    ],
  },
  {
    module: 'alacena',
    paths: ['/alacena'],
    steps: [
      { selector: '[data-tour="alacena-add"]', title: 'Agregar producto', description: 'Agrega productos manualmente para mantener actualizado el inventario de tu hogar.' },
      { selector: '[data-tour="alacena-barcode"]', title: 'Escanear codigo', description: 'Escanea un producto para cargarlo automaticamente utilizando su codigo de barras.' },
      { selector: '[data-tour="alacena-ticket"]', title: 'Escanear ticket', description: 'Escanea un ticket de compra para registrar multiples productos de forma automatica.' },
      { selector: '[data-tour="product-summary"]', title: 'Detalle del producto', description: 'Aca ves cantidad disponible, vencimiento, estado y el resumen de consumo del producto.' },
      { selector: '[data-tour="product-nutrition-scan"], [data-tour="product-nutrition-info"]', title: 'Informacion nutricional', description: 'Si el producto fue cargado a mano, podes sacar una foto de la tabla nutricional para completar sus datos. Cuando ya existen, se muestran en esta seccion.' },
      { selector: '[data-tour="product-actions"]', title: 'Acciones del producto', description: 'Desde estos botones podes agregarlo a la lista de compras, editar sus datos o marcarlo como consumido/terminado.' },
    ],
  },
  {
    module: 'recetas',
    paths: ['/recetas'],
    steps: [
      { selector: '[data-tour="recipes-search"]', title: 'Buscador', description: 'Busca recetas utilizando texto libre, ingredientes especificos u objetivos nutricionales.' },
      { selector: '[data-tour="recipes-filters"]', title: 'Filtros inteligentes', description: 'Usa estos filtros para ver guardadas, dificultad, coincidencia con tu alacena, electrodomesticos disponibles y, especialmente, respetar alergenos o restricciones si estan cargados en tu perfil.' },
      { selector: '[data-tour="recipes-list"]', title: 'Recetas sugeridas', description: 'Las recetas se adaptan a los ingredientes disponibles en tu alacena y a las restricciones alimentarias configuradas.' },
      { selector: '[data-tour="recipes-roulette"]', title: 'Ruleta', description: 'Si no sabes que cocinar, la ruleta selecciona una receta aleatoria cuando tenes al menos el 50% de sus ingredientes disponibles.' },
      { selector: '[data-tour="recipes-assistant"]', title: 'Asistente de cocina', description: 'Desde este boton podes abrir el asistente para hacer preguntas sobre recetas, ingredientes, reemplazos o ideas segun tu alacena.', side: 'left' },
      { selector: '[data-tour="recipe-save"]', title: 'Guardar receta', description: 'Guarda la receta para encontrarla rapido despues desde los filtros o tu listado de recetas guardadas.' },
      { selector: '[data-tour="recipe-ingredients"]', title: 'Ingredientes necesarios', description: 'Aca ves que ingredientes pide la receta, las cantidades y cuales ya tenes disponibles en la alacena.' },
      { selector: '[data-tour="recipe-steps"]', title: 'Pasos de preparacion', description: 'Consulta el paso a paso de la receta antes de cocinar para organizar ingredientes, tiempos y utensilios.' },
      { selector: '[data-tour="recipe-add-shopping"]', title: 'Lista de compras', description: 'En el detalle de una receta podes agregar automaticamente los ingredientes faltantes a tu lista de compras.' },
      { selector: '[data-tour="recipe-reviews"]', title: 'Puntuar la comida', description: 'Despues de probarla, podes puntuar la receta y dejar una resena para recordar que funciono mejor.' },
    ],
  },
  {
    module: 'lista-compras',
    paths: ['/lista-compras'],
    steps: [
      { selector: '[data-tour="shopping-new-list"]', title: 'Nueva lista', description: 'Crea una lista de compras manualmente.' },
      { selector: '[data-tour="shopping-telegram"]', title: 'Enviar a Telegram', description: 'Envia la lista activa o todas las compras pendientes a Telegram para tenerlas a mano fuera de la app. Necesitas tener Telegram vinculado en Configuracion.' },
      { selector: '[data-tour="shopping-price-search"]', title: 'Buscar precios', description: 'Compara precios de productos en cadenas grandes de supermercados y comercios para decidir donde conviene comprar.' },
      { selector: '[data-tour="shopping-list"]', title: 'Listado', description: 'Tambien podes recibir ingredientes automaticamente desde una receta.' },
      { selector: '[data-tour="shopping-check"]', title: 'Marcar comprado', description: 'Marca los productos comprados para mantener la lista organizada.' },
    ],
  },
  {
    module: 'electrodomesticos',
    paths: ['/electrodomesticos'],
    steps: [
      { selector: '[data-tour="appliances-add"]', title: 'Agregar electrodomestico', description: 'Carga los electrodomesticos disponibles en tu hogar para que Nido recomiende recetas con mas precision.' },
      { selector: '[data-tour="appliances-list"]', title: 'Tus electrodomesticos', description: 'Aca ves los dispositivos cargados, su tipo y estado. Si un electrodomestico esta fuera de servicio, las recetas pueden evitar depender de el.' },
      { selector: '[data-tour="appliances-status"]', title: 'Estado y mantenimiento', description: 'Mantener actualizado el estado ayuda a que las sugerencias de comidas sean realistas para lo que podes cocinar hoy.' },
    ],
  },
  {
    module: 'finanzas',
    paths: ['/finanzas'],
    steps: [
      { selector: '[data-tour="finance-add-expense"]', title: 'Registrar gasto', description: 'Registra gastos del hogar para llevar un control de los consumos.' },
      { selector: '[data-tour="finance-saving-mode"]', title: 'Modo ahorro', description: 'Activa el modo ahorro para priorizar recomendaciones y decisiones orientadas a gastar menos en el hogar.' },
      { selector: '[data-tour="finance-summary-cards"]', title: 'Resumen de gastos', description: 'En estas cards podes ir viendo tus gastos del mes, el presupuesto disponible y las cuentas compartidas del hogar.' },
      { selector: '[data-tour="finance-scan-ticket"]', title: 'Escanear ticket', description: 'Escanea un ticket para registrar automaticamente los productos comprados y el gasto correspondiente.' },
    ],
  },
  {
    module: 'planificador',
    paths: ['/planificador'],
    steps: [
      { selector: '[data-tour="planner-calendar"]', title: 'Calendario semanal', description: 'Planifica las comidas de toda la semana.' },
      { selector: '[data-tour="planner-meals"]', title: 'Seleccion de comidas', description: 'Asigna recetas a cada dia para organizar mejor las compras y el consumo. Tambien podes distribuir tareas del hogar durante la semana.' },
    ],
  },
  {
    module: 'tareas',
    paths: ['/tareas'],
    steps: [
      { selector: '[data-tour="tasks-new"]', title: 'Nueva tarea', description: 'Crea tareas del hogar y asignalas a los integrantes.' },
      { selector: '[data-tour="tasks-status"]', title: 'Estado de tareas', description: 'Hace seguimiento del progreso y completa las tareas pendientes.' },
    ],
  },
  {
    module: 'notificaciones',
    paths: ['/notificaciones'],
    steps: [
      { selector: '[data-tour="notifications-list"]', title: 'Notificaciones', description: 'Aca recibis avisos importantes sobre productos por vencer, tareas pendientes, recordatorios y otras novedades del hogar.' },
    ],
  },
  {
    module: 'perfil',
    paths: ['/perfil'],
    steps: [
      { selector: '[data-tour="profile-personal-data"]', title: 'Datos personales', description: 'Actualiza tu informacion personal y preferencias.' },
      { selector: '[data-tour="profile-food-restrictions"]', title: 'Alergias y restricciones', description: 'Carga alergias y restricciones alimentarias para que Nido pueda recomendar recetas mas seguras y personalizadas.' },
      { selector: '[data-tour="profile-invite-member"]', title: 'Invitar conviviente', description: 'Si compartis el hogar, podes invitar a otra persona para gestionar compras, tareas y gastos en conjunto.' },
    ],
  },
  {
    module: 'configuracion',
    paths: ['/configuracion'],
    steps: [
      { selector: '[data-tour="settings-household"]', title: 'Cuenta', description: 'Revisa los datos principales de tu cuenta y cerra sesion cuando lo necesites.' },
      { selector: '[data-tour="settings-appearance"]', title: 'Apariencia', description: 'Elegi como queres ver Nido: modo claro, modo oscuro o automatico segun la configuracion del sistema.' },
      { selector: '[data-tour="settings-members"]', title: 'Integrantes', description: 'Invita convivientes para gestionar el hogar de forma colaborativa.' },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class ContextualTutorialService {
  private readonly api = inject(OnboardingApiService);
  private readonly state = signal<TutorialUsuarioState | null>(null);
  private readonly loadingState = signal(false);
  private readonly activeDriver = signal<Driver | null>(null);
  private readonly currentDefinition = signal<TutorialDefinition | null>(null);
  private readonly autoStarted = new Set<TutorialModule>();
  private readonly pendingRetries = new Map<TutorialModule, number>();

  readonly hasCurrentTutorial = computed(() => this.currentDefinition() !== null);
  readonly isRunning = computed(() => this.activeDriver()?.isActive() ?? false);

  handleRoute(url: string): void {
    const definition = this.findDefinition(url);
    this.currentDefinition.set(definition);
    if (!definition) return;

    this.pendingRetries.delete(definition.module);
    window.setTimeout(() => this.startIfPending(definition), 450);
  }

  startCurrentManually(): void {
    const definition = this.currentDefinition();
    if (!definition) return;
    window.setTimeout(() => this.start(definition, true), 80);
  }

  private startIfPending(definition: TutorialDefinition): void {
    if (this.currentDefinition()?.module !== definition.module) return;
    if (this.autoStarted.has(definition.module)) return;
    this.ensureState((state) => {
      if (state[COMPLETED_FIELD[definition.module]]) return;
      this.start(definition, false);
    });
  }

  private start(definition: TutorialDefinition, manual: boolean): boolean {
    const steps = this.resolveSteps(definition);
    if (steps.length === 0) {
      if (!manual && this.scheduleRetry(definition)) {
        return false;
      }

      return false;
    }

    this.autoStarted.add(definition.module);
    this.pendingRetries.delete(definition.module);
    this.activeDriver()?.destroy();
    let completed = false;
    const markCompleted = () => {
      if (completed) return;
      completed = true;
      this.api.completeTutorial(definition.module)
        .pipe(take(1), catchError(() => of(null)))
        .subscribe((state) => {
          if (state) this.state.set(state);
        });
    };

    const instance = driver({
      steps,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      allowScroll: true,
      overlayColor: document.documentElement.classList.contains('dark') ? '#050806' : '#1f2a24',
      overlayOpacity: 0.68,
      stagePadding: 8,
      stageRadius: 10,
      popoverClass: 'nido-driver-popover',
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      showButtons: ['previous', 'next', 'close'],
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = '\u00d7';
        popover.closeButton.title = manual ? 'Cerrar' : 'Omitir';
        popover.closeButton.setAttribute('aria-label', manual ? 'Cerrar tutorial' : 'Omitir tutorial');
      },
      onDoneClick: (_element, _step, opts) => {
        markCompleted();
        opts.driver.destroy();
      },
      onCloseClick: (_element, _step, opts) => {
        markCompleted();
        opts.driver.destroy();
      },
      onDestroyed: () => this.activeDriver.set(null),
    });

    this.activeDriver.set(instance);
    instance.drive();
    return true;
  }

  private resolveSteps(definition: TutorialDefinition): DriveStep[] {
    return definition.steps
      .map((step) => ({ step, element: document.querySelector(step.selector) }))
      .filter((entry): entry is { step: TutorialStep; element: Element } => entry.element !== null)
      .map(({ step, element }) => ({
        element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? 'bottom',
          align: 'center',
        },
      }));
  }

  private ensureState(callback: (state: TutorialUsuarioState) => void): void {
    const cached = this.state();
    if (cached) {
      callback(cached);
      return;
    }

    if (this.loadingState()) return;
    this.loadingState.set(true);
    this.api.getTutorialState()
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((state) => {
        this.loadingState.set(false);
        if (!state) return;
        this.state.set(state);
        callback(state);
      });
  }

  private scheduleRetry(definition: TutorialDefinition): boolean {
    const attempts = this.pendingRetries.get(definition.module) ?? 0;
    if (attempts >= 12) return false;

    this.pendingRetries.set(definition.module, attempts + 1);
    window.setTimeout(() => this.startIfPending(definition), 500);
    return true;
  }

  private findDefinition(url: string): TutorialDefinition | null {
    const path = url.split('?')[0].replace(/\/$/, '') || '/';
    if (/^\/recetas\/[^/]+$/.test(path)) {
      return TUTORIALS.find((tutorial) => tutorial.module === 'recetas') ?? null;
    }

    if (/^\/alacena\/(?!escanear-ticket$)[^/]+$/.test(path)) {
      return TUTORIALS.find((tutorial) => tutorial.module === 'alacena') ?? null;
    }

    return TUTORIALS.find((tutorial) => tutorial.paths.includes(path)) ?? null;
  }
}
