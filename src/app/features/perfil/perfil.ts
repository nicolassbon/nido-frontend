import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { timer, EMPTY, concat, of, Subscription, TimeoutError } from 'rxjs';
import { concatMap, take, takeWhile, catchError, timeout, tap } from 'rxjs/operators';
import { StatCard } from '../../shared/ui/stat-card/stat-card';
import { PreferenceCard } from '../../shared/ui/preference-card/preference-card';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { PerfilApiService, PerfilApiResponse } from './perfil-api.service';
import { OnboardingApiService, RestriccionCatalogo } from '../onboarding/onboarding-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { EditarPerfil } from '../editar-perfil/editar-perfil';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { TareasApiService } from '../tareas/services/tareas-api.service';
import { getCompanionInfo } from '../../shared/constants/companion-metadata';
import { PaywallService } from '../../core/servicios/paywall';
import { normalizePaymentReturnStatus } from '../../core/payment-return';
import { PostPaymentReturnService, PREMIUM_ACTIVATED_MESSAGE } from '../../core/post-payment-return';

const PAYMENT_NOTICE_KIND = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

const PAYMENT_NOTICE_ACTION = {
  RETRY: 'retry',
  UPGRADE: 'upgrade',
} as const;

type PaymentNoticeKind = (typeof PAYMENT_NOTICE_KIND)[keyof typeof PAYMENT_NOTICE_KIND];
type PaymentNoticeAction = (typeof PAYMENT_NOTICE_ACTION)[keyof typeof PAYMENT_NOTICE_ACTION];

interface PaymentNotice {
  kind: PaymentNoticeKind;
  message: string;
  action?: PaymentNoticeAction;
}

const AUTH_REFRESH_TIMEOUT_MS = 4_000;
const PAYMENT_REFRESH_ATTEMPTS = 6;
const PAYMENT_REFRESH_INTERVAL_MS = 1_500;

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, StatCard, PreferenceCard, LucideAngularModule, EditarPerfil, Avatar],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent implements OnInit {
  private readonly perfilApi = inject(PerfilApiService);
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly authService = inject(AuthService);
  private readonly tareasApi = inject(TareasApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paywall = inject(PaywallService);
  private readonly postPaymentReturn = inject(PostPaymentReturnService);

  protected readonly usuario = signal<PerfilApiResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly apiError = signal<string | null>(null);
  protected readonly nombreHogar = signal<string | null>(null);
  protected readonly nivelNido = signal<number>(0);
  protected readonly paymentNotice = signal<PaymentNotice | null>(null);
  protected readonly isReconcilingPayment = signal(false);
  protected readonly paymentActionLabel = computed(() => {
    const action = this.paymentNotice()?.action;
    if (action === PAYMENT_NOTICE_ACTION.UPGRADE) return 'Elegir Plan Hogar';
    if (action === PAYMENT_NOTICE_ACTION.RETRY) return 'Reintentar verificación';
    return null;
  });
  protected readonly isPremium = this.authService.isPremium;
  private handledPaymentStatus: string | null = null;
  private paymentRefreshSubscription: Subscription | null = null;
  private paymentRefreshSequence = 0;
  private paymentRefreshSucceeded = false;
  private paymentRefreshConfirmedPremium = false;

  protected readonly premiumExpirationText = computed(() => {
    const subscriptionEndsAt = this.authService.getSubscriptionEndsAt();
    const trialEndsAt = this.authService.getTrialEndsAt();
    const date = subscriptionEndsAt ?? trialEndsAt;
    if (!date) return null;

    try {
      const formatted = new Date(date).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return subscriptionEndsAt
        ? `Tu suscripción está activa hasta el ${formatted}.`
        : `Tu período de prueba está activo hasta el ${formatted}.`;
    } catch {
      return null;
    }
  });
  protected readonly statCards = computed(() => {
    const profile = this.usuario();
    const level = this.nivelNido();
    const tareasCompletadas = profile?.tareasCompletadas ?? 0;
    const productosEscaneados = profile?.productosEscaneados ?? 0;
    const logros = profile?.logros ?? 0;
    const levelName = getCompanionInfo(level).name;

    return [
      {
        icon: 'check-square',
        value: tareasCompletadas,
        title: 'Tareas completadas',
        subtitle: tareasCompletadas > 0
          ? 'Tareas terminadas por vos en este hogar.'
          : 'Todavia no hay tareas completadas.',
      },
      {
        icon: 'scan-line',
        value: productosEscaneados,
        title: 'Productos escaneados',
        subtitle: productosEscaneados > 0
          ? 'Productos cargados con codigo de barras.'
          : 'Todavia no hay productos escaneados.',
      },
      {
        icon: 'trophy',
        value: logros,
        title: 'Logros',
        subtitle: logros > 0
          ? `Logros desbloqueados (Pip Nivel ${level}: ${levelName}).`
          : 'Todavia no hay logros desbloqueados.',
      },
    ];
  });

  // --- Estados de Edición ---
  protected readonly isEditingAlergias = signal(false);
  protected readonly isEditingAlimentacion = signal(false);
  protected readonly isSaving = signal(false);

  // --- Catálogos ---
  protected readonly preferencias = signal<RestriccionCatalogo[]>([]);
  protected readonly allAlergias = signal<RestriccionCatalogo[]>([]);

  // --- Selecciones temporales ---
  protected readonly selectedPreferenciaIds = signal<Set<string>>(new Set());
  protected readonly selectedAlergias = signal<RestriccionCatalogo[]>([]);

  // --- Editar perfil (modal) ---
  protected readonly showEditModal = signal(false);

  protected onEditClosed(saved: boolean): void {
    this.showEditModal.set(false);
    if (saved) this.cargarPerfil();
  }

  // --- Crear hogar adicional ---
  protected readonly showCrearHogarModal = signal(false);
  protected readonly crearHogarNombre    = signal('');
  protected readonly crearHogarState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly crearHogarErrorMsg  = signal('');
  protected readonly crearHogarNombreCreado = signal('');

  protected openCrearHogarModal(): void {
    this.showCrearHogarModal.set(true);
  }

  protected closeCrearHogarModal(): void {
    this.showCrearHogarModal.set(false);
    this.crearHogarNombre.set('');
    this.crearHogarState.set('idle');
    this.crearHogarErrorMsg.set('');
  }

  protected submitCrearHogar(): void {
    const nombre = this.crearHogarNombre().trim();
    if (!nombre) return;

    this.crearHogarState.set('loading');
    this.hogaresApi.crearHogar(nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.authService.setToken(res.accessToken);
          this.crearHogarNombreCreado.set(res.hogarNombre);
          this.nombreHogar.set(res.hogarNombre);
          this.crearHogarState.set('success');
          this.cargarPerfil();
        },
        error: (err) => {
          console.error('[PerfilComponent.submitCrearHogar Error]', err);
          this.crearHogarErrorMsg.set(err.error?.message ?? 'Error al crear el hogar.');
          this.crearHogarState.set('error');
        },
      });
  }

  // --- Invitar familiar ---
  protected readonly showInviteModal = signal(false);
  protected readonly inviteEmail     = signal('');
  protected readonly inviteState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly inviteErrorMsg  = signal('');

  protected openInviteModal(): void {
    this.inviteEmail.set('');
    this.inviteState.set('idle');
    this.inviteErrorMsg.set('');
    this.showInviteModal.set(true);
  }

  protected closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  protected submitInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) return;

    this.inviteState.set('loading');
    this.hogaresApi.invitar(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.inviteState.set('success'),
        error: (err) => {
          console.error('[PerfilComponent.submitInvite Error]', err);
          this.inviteErrorMsg.set(err.error?.message ?? 'Error al enviar la invitación.');
          this.inviteState.set('error');
        },
      });
  }

  // --- Buscador de Alergias ---
  protected readonly alergiaSearch = signal('');
  protected readonly alergiaInputFocused = signal(false);

  protected readonly alergiaResults = computed(() => {
    const term = this.alergiaSearch().toLowerCase().trim();
    const selectedIds = new Set(this.selectedAlergias().map(a => a.id));
    return this.allAlergias().filter(
      a => !selectedIds.has(a.id) && (term === '' || a.nombre.toLowerCase().includes(term)),
    );
  });

  protected readonly showAlergiaDropdown = computed(
    () => this.alergiaInputFocused() && this.alergiaResults().length > 0,
  );

  ngOnInit(): void {
    this.cargarPerfil();

    // On manual F5 / direct navigation the JWT in localStorage may be stale
    // (e.g. the DB was upgraded to Premium by the Mercado Pago webhook before
    // the user returned). Refresh auth state eagerly so isPremium reflects the
    // current household plan.
    if (this.authService.isAuthenticated()) {
      this.authService.refresh().pipe(
        timeout(AUTH_REFRESH_TIMEOUT_MS),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe();
    }

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.handlePaymentStatus(params['status']);
    });

    this.tareasApi.getProgreso()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => {
          this.nivelNido.set(Math.min(5, Math.max(0, p.currentLevel)));
        },
        error: err => {
          console.error('[PerfilComponent.getProgreso Error]', err);
        }
      });

    this.hogaresApi.getHogar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: hogar => this.nombreHogar.set(hogar.nombre),
        error: err => {
          console.error('[PerfilComponent.getHogar Error]', err);
        }
      });

    // Precargar catálogos
    this.onboardingApi.getPreferenciasAlimentarias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => this.preferencias.set(data),
        error: err => {
          console.error('[PerfilComponent.getPreferenciasAlimentarias Error]', err);
        }
      });
    this.onboardingApi.getAlergias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => this.allAlergias.set(data),
        error: err => {
          console.error('[PerfilComponent.getAlergias Error]', err);
        }
      });
  }

  private cargarPerfil(): void {
    this.perfilApi.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.usuario.set(profile);
          this.isLoading.set(false);
        },
        error: err => {
          console.error('[PerfilComponent.cargarPerfil Error]', err);
          this.apiError.set('No se pudo cargar la información del perfil. Verificá la conexión.');
          this.isLoading.set(false);
        },
      });
  }

  protected retryPaymentStatus(): void {
    const action = this.paymentNotice()?.action;
    if (action === PAYMENT_NOTICE_ACTION.UPGRADE) {
      this.paywall.open();
      return;
    }

    if (action === PAYMENT_NOTICE_ACTION.RETRY) {
      this.reconcilePaymentStatus();
    }
  }

  protected paymentNoticeClass(kind: PaymentNoticeKind): string {
    switch (kind) {
      case PAYMENT_NOTICE_KIND.SUCCESS:
        return 'bg-emerald-50 border border-emerald-200 text-emerald-800';
      case PAYMENT_NOTICE_KIND.WARNING:
        return 'bg-amber-50 border border-amber-200 text-amber-900';
      case PAYMENT_NOTICE_KIND.ERROR:
        return 'bg-red-50 border border-red-200 text-red-800';
      default:
        return 'bg-sky-50 border border-sky-200 text-sky-900';
    }
  }

  private handlePaymentStatus(status: unknown): void {
    const normalizedStatus = normalizePaymentReturnStatus(status);

    if (!normalizedStatus || normalizedStatus === this.handledPaymentStatus) return;

    this.handledPaymentStatus = normalizedStatus;
    this.consumePaymentStatusQuery();

    switch (normalizedStatus) {
      case 'success':
        this.reconcilePaymentStatus();
        return;
      case 'pending':
        this.postPaymentReturn.clearCheckoutOrigin();
        this.paymentNotice.set({
          kind: PAYMENT_NOTICE_KIND.INFO,
          message: 'Todavía no confirmamos el pago. Esperá unos minutos y volvé a verificar el estado antes de usar las funciones del Plan Hogar.',
          action: PAYMENT_NOTICE_ACTION.RETRY,
        });
        return;
      case 'failure':
      case 'cancelled':
        this.postPaymentReturn.clearCheckoutOrigin();
        this.paymentNotice.set({
          kind: PAYMENT_NOTICE_KIND.ERROR,
          message: 'El pago no se completó. No se aplicaron cambios a tu plan. Podés intentarlo nuevamente cuando quieras.',
          action: PAYMENT_NOTICE_ACTION.UPGRADE,
        });
        return;
      default:
        this.postPaymentReturn.clearCheckoutOrigin();
        this.paymentNotice.set({
          kind: PAYMENT_NOTICE_KIND.WARNING,
          message: 'No pudimos confirmar el estado del pago. Verificá tu plan antes de usar las funciones del Plan Hogar.',
          action: PAYMENT_NOTICE_ACTION.RETRY,
        });
    }
  }

  private consumePaymentStatusQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private reconcilePaymentStatus(): void {
    this.paymentRefreshSubscription?.unsubscribe();
    const refreshSequence = ++this.paymentRefreshSequence;
    this.paymentRefreshSucceeded = false;
    this.paymentRefreshConfirmedPremium = false;
    this.isReconcilingPayment.set(true);
    this.paymentNotice.set({
      kind: PAYMENT_NOTICE_KIND.INFO,
      message: 'Recibimos tu pago. Estamos activando tu Plan Hogar; esto puede demorar unos minutos.',
    });

    const immediateRefresh$ = this.refreshPremiumState();
    const delayedRefreshes$ = timer(PAYMENT_REFRESH_INTERVAL_MS, PAYMENT_REFRESH_INTERVAL_MS).pipe(
      take(PAYMENT_REFRESH_ATTEMPTS - 1),
      concatMap(() => this.refreshPremiumState()),
    );

    const subscription = concat(immediateRefresh$, delayedRefreshes$).pipe(
      takeWhile(() => !this.paymentRefreshConfirmedPremium, true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      complete: () => this.finishPaymentReconciliation(refreshSequence),
    });

    this.paymentRefreshSubscription = subscription.closed ? null : subscription;
  }

  private refreshPremiumState() {
    return this.authService.refresh().pipe(
      timeout(AUTH_REFRESH_TIMEOUT_MS),
      tap(() => {
        this.paymentRefreshSucceeded = true;
        this.paymentRefreshConfirmedPremium = this.authService.isPremium();
      }),
      catchError(error => {
        console.error('[PerfilComponent.paymentRefresh Error]', {
          reason: error instanceof TimeoutError ? 'timeout' : 'request-failed',
        });
        return of(null);
      }),
    );
  }

  private finishPaymentReconciliation(refreshSequence: number): void {
    if (refreshSequence !== this.paymentRefreshSequence) return;

    this.paymentRefreshSubscription = null;
    this.isReconcilingPayment.set(false);

    if (this.paymentRefreshConfirmedPremium) {
      const showInlineSuccess = () => {
        if (refreshSequence !== this.paymentRefreshSequence) return;
        this.paymentNotice.set({
          kind: PAYMENT_NOTICE_KIND.SUCCESS,
          message: PREMIUM_ACTIVATED_MESSAGE,
        });
      };

      void this.postPaymentReturn.redirectAfterConfirmedPayment()
        .then((redirected) => {
          if (!redirected) showInlineSuccess();
        })
        .catch(showInlineSuccess);
      return;
    }

    if (!this.paymentRefreshSucceeded) {
      this.postPaymentReturn.clearCheckoutOrigin();
      this.paymentNotice.set({
        kind: PAYMENT_NOTICE_KIND.WARNING,
        message: 'El pago fue informado como aprobado, pero no pudimos verificar la activación por un problema de conexión. Reintentá la verificación antes de usar las funciones premium.',
        action: PAYMENT_NOTICE_ACTION.RETRY,
      });
      return;
    }

    this.postPaymentReturn.clearCheckoutOrigin();
    this.paymentNotice.set({
      kind: PAYMENT_NOTICE_KIND.WARNING,
      message: 'El pago fue recibido, pero todavía no pudimos confirmar la activación. Esperá unos minutos y volvé a verificar el estado.',
      action: PAYMENT_NOTICE_ACTION.RETRY,
    });
  }

  // --- Acciones de Alimentación ---
  protected startEditingAlimentacion(): void {
    const currentNames = this.usuario()?.alimentacion ?? [];
    const matchedIds = this.preferencias()
      .filter(p => currentNames.includes(p.nombre))
      .map(p => p.id);
    
    this.selectedPreferenciaIds.set(new Set(matchedIds));
    this.isEditingAlimentacion.set(true);
  }

  protected cancelEditingAlimentacion(): void {
    this.isEditingAlimentacion.set(false);
  }

  protected saveEditingAlimentacion(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const ids = Array.from(this.selectedPreferenciaIds());
    this.perfilApi.updateRestricciones('restriccion_alimentaria', ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isEditingAlimentacion.set(false);
          this.cargarPerfil();
        },
        error: (err) => {
          console.error('[PerfilComponent.saveEditingAlimentacion Error]', err);
          this.isSaving.set(false);
          alert('Error al guardar las preferencias de alimentación.');
        }
      });
  }

  protected isPreferenciaSelected(id: string): boolean {
    return this.selectedPreferenciaIds().has(id);
  }

  protected togglePreferencia(id: string): void {
    this.selectedPreferenciaIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  protected getPrefIcon(nombre: string): string {
    const icons: Record<string, string> = {
      'Vegano':       'sprout',
      'Vegetariano':  'leaf',
      'Sin TACC':     'wheat-off',
      'Sin lactosa':  'milk-off',
    };
    return icons[nombre] ?? 'leaf';
  }

  // --- Acciones de Alergias ---
  protected startEditingAlergias(): void {
    const currentNames = this.usuario()?.alergias ?? [];
    const matched = this.allAlergias().filter(a => currentNames.includes(a.nombre));
    
    this.selectedAlergias.set(matched);
    this.alergiaSearch.set('');
    this.isEditingAlergias.set(true);
  }

  protected cancelEditingAlergias(): void {
    this.isEditingAlergias.set(false);
  }

  protected saveEditingAlergias(): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const ids = this.selectedAlergias().map(a => a.id);
    this.perfilApi.updateRestricciones('alergia', ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isEditingAlergias.set(false);
          this.cargarPerfil();
        },
        error: (err) => {
          console.error('[PerfilComponent.saveEditingAlergias Error]', err);
          this.isSaving.set(false);
          alert('Error al guardar las alergias.');
        }
      });
  }

  protected addAlergia(alergia: RestriccionCatalogo): void {
    this.selectedAlergias.update(list => [...list, alergia]);
    this.alergiaSearch.set('');
  }

  protected removeAlergia(id: string): void {
    this.selectedAlergias.update(list => list.filter(a => a.id !== id));
  }

  protected onAlergiaBlur(): void {
    setTimeout(() => this.alergiaInputFocused.set(false), 150);
  }

  protected upgradeToPremium(): void {
    this.paywall.open();
  }

  // --- Clases Auxiliares de Estilos ---
  protected prefCardClass(selected: boolean): string {
    const base = 'relative flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-[1.5px] border-solid cursor-pointer transition-all duration-150 w-full';
    return selected
      ? `${base} bg-nido-green-dark border-nido-green-dark`
      : `${base} bg-white/[0.51] border-nido-border hover:border-nido-green`;
  }

  protected prefIconBgClass(selected: boolean): string {
    return selected
      ? 'w-8 h-8 rounded-lg flex items-center justify-center bg-white/15 transition-all duration-150'
      : 'w-8 h-8 rounded-lg flex items-center justify-center bg-nido-cream transition-all duration-150';
  }

  protected prefIconColorClass(selected: boolean): string {
    return selected ? 'text-nido-cream' : 'text-nido-green';
  }

}
