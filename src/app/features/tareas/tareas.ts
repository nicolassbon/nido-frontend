import {
  Component, OnInit, DestroyRef, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideAngularModule, Plus, Check, X,
  Calendar, ChevronRight, ChevronDown, Clock, AlertCircle,
  CheckSquare, ClipboardList, History, Lock,
} from 'lucide-angular';
import { TareasApiService, TareaResponse, DistribucionSemanalResponse, GamificacionProgresoResponse } from './services/tareas-api.service';
import { HogaresApiService, MiembroResponse } from '../household/hogares-api.service';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';
import { AuthService } from '../../core/auth/auth.service';
import { forkJoin, of, switchMap, catchError } from 'rxjs';
import { getCompanionInfo } from '../../shared/constants/companion-metadata';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, NidoDatepickerComponent, NidoSelectComponent],
  templateUrl: './tareas.html',
  styleUrl: './tareas.scss',
})
export class Tareas implements OnInit {
  private readonly api = inject(TareasApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly icons = {
    Plus, Check, X, Calendar, ChevronRight, ChevronDown, Clock, AlertCircle,
    CheckSquare, ClipboardList, History, Lock,
  };

  // ── Estado principal ─────────────────────────────────────
  protected readonly misTareas = signal<TareaResponse[]>([]);
  protected readonly xp = signal<number>(0); // XP acumulado total
  protected readonly nivel = signal<number>(0); // Nivel inicial 0 (bloqueado)
  protected readonly evolucionando = signal<boolean>(false);
  protected readonly imagenNivel = signal<number>(1);
  protected readonly floatingXPs = signal<{ id: number; value: string }[]>([]);
  protected readonly hasNextLevel = signal<boolean>(false);
  protected readonly nextThresholdXp = signal<number | null>(null);
  protected readonly xpToNextLevel = signal<number | null>(null);

  protected readonly porcentajeXp = computed(() => {
    if (!this.hasNextLevel()) return 100;
    const threshold = this.nextThresholdXp() ?? this.xp() + (this.xpToNextLevel() ?? 0);
    if (threshold <= 0) return 0;
    return Math.min(100, Math.max(0, (this.xp() / threshold) * 100));
  });

  protected readonly xpEnNivelActual = computed(() => this.xp());

  protected readonly xpNecesariaParaSiguienteNivel = computed(() => {
    if (!this.hasNextLevel()) return 0;
    return this.nextThresholdXp() ?? this.xp() + (this.xpToNextLevel() ?? 0);
  });

  protected readonly xpSiguienteNivelTotal = computed(() => this.xpNecesariaParaSiguienteNivel());
  protected readonly mostrarCelebracionLevelUp = signal<boolean>(false);
  protected readonly nivelCelebrado = signal<number>(1);
  protected readonly userId = signal<string | null>(null);
  private levelUpTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private errorTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private scrollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private floatingXPTimers: ReturnType<typeof setTimeout>[] = [];
  protected readonly errorMsg = signal<string | null>(null);

  protected showError(message: string): void {
    this.errorMsg.set(message);
    if (this.errorTimeoutId) {
      clearTimeout(this.errorTimeoutId);
    }
    this.errorTimeoutId = setTimeout(() => {
      this.errorMsg.set(null);
      this.errorTimeoutId = null;
    }, 5000);
  }

  protected cerrarError(): void {
    this.errorMsg.set(null);
    if (this.errorTimeoutId) {
      clearTimeout(this.errorTimeoutId);
      this.errorTimeoutId = null;
    }
  }


  protected readonly todasTareas = signal<TareaResponse[]>([]);
  protected readonly misTareasConResaltada = computed(() => {
    const list = [...this.misTareas()];
    const highlightedId = this.highlightedTaskId();
    if (highlightedId && !list.some(t => t.id === highlightedId)) {
      const highlightedTask = this.todasTareas().find(t => t.id === highlightedId);
      if (highlightedTask) {
        list.push(highlightedTask);
      }
    }
    return list;
  });
  protected readonly distribucion = signal<DistribucionSemanalResponse | null>(null);
  protected readonly miembros = signal<MiembroResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly mostrarModal = signal(false);
  protected readonly mostrarModalMisTareas = signal(false);
  protected readonly mostrarModalAvatar = signal<boolean>(false);
  protected readonly highlightedTaskId = signal<string | null>(null);

  protected readonly companionInfo = computed(() => {
    const lvl = this.nivel();
    return getCompanionInfo(lvl);
  });

  protected getCompanionName(lvl: number): string {
    return getCompanionInfo(lvl).name;
  }

  protected getCompanionDesc(lvl: number): string {
    return getCompanionInfo(lvl).desc;
  }

  private clampLevel(level: number): number {
    return Math.min(5, Math.max(0, level));
  }

  private applyProgress(progress: GamificacionProgresoResponse): void {
    const level = this.clampLevel(progress.currentLevel);
    this.nivel.set(level);
    this.xp.set(progress.currentXp);
    this.imagenNivel.set(Math.min(5, Math.max(1, level)));
    this.hasNextLevel.set(progress.hasNextLevel);
    this.nextThresholdXp.set(progress.nextThresholdXp);
    this.xpToNextLevel.set(progress.xpToNextLevel);
  }

  protected readonly reasignandoTareaId = signal<string | null>(null);
  protected readonly reasignandoPos = signal<{ top: number; left: number } | null>(null);

  protected readonly tareasPreview = computed(() =>
    this.todasTareas()
      .filter(t => t.estado !== 'completada')
      .sort((a, b) => {
        if (!a.fechaLimite && !b.fechaLimite) return 0;
        if (!a.fechaLimite) return 1;
        if (!b.fechaLimite) return -1;
        return new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime();
      })
  );

  protected readonly historialTareas = computed(() =>
    this.todasTareas()
      .filter(t => t.estado === 'completada')
      .sort((a, b) => {
        if (!a.fechaCompletado && !b.fechaCompletado) return 0;
        if (!a.fechaCompletado) return 1;
        if (!b.fechaCompletado) return -1;
        return new Date(b.fechaCompletado).getTime() - new Date(a.fechaCompletado).getTime();
      })
  );

  protected readonly miembrosOpts = computed<NidoSelectOption[]>(() => [
    { value: null, label: 'Sin asignar' },
    ...this.miembros().map(m => ({ value: m.usuarioId, label: m.nombre })),
  ]);

  // ── Form nueva tarea ─────────────────────────────────────
  protected nuevoTitulo = '';
  protected nuevaDescripcion = '';
  protected nuevaFechaLimite = '';
  protected nuevoAsignadoA: string | null = null;
  protected guardando = false;

  // ── Chart: escala dinámica ───────────────────────────────
  protected readonly maxCompletadas = computed(() => {
    const d = this.distribucion();
    if (!d) return 0;
    let max = 0;
    for (const dia of d.dias) {
      for (const m of dia.miembros) {
        if (m.completadas > max) max = m.completadas;
      }
    }
    return max;
  });

  protected readonly coloresMiembros = [
    '#B48B6A', '#7A5A45', '#9a806c', '#c4956a', '#8B6E58', '#6B4E3D',
  ];

  ngOnInit(): void {
    this.userId.set(this.auth.getUserId());
    this.cargarDatos();
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const taskId = params['taskId'];
        if (taskId) {
          this.highlightedTaskId.set(taskId);
          this.abrirModalMisTareas();
        }
      });

    this.destroyRef.onDestroy(() => {
      if (this.levelUpTimeoutId) {
        clearTimeout(this.levelUpTimeoutId);
      }
      if (this.errorTimeoutId) {
        clearTimeout(this.errorTimeoutId);
      }
      if (this.scrollTimeoutId) {
        clearTimeout(this.scrollTimeoutId);
      }
      this.floatingXPTimers.forEach(t => clearTimeout(t));
      this.floatingXPTimers = [];
    });
  }

  private cargarDatos(): void {
    this.loading.set(true);
    this.api.getMisTareas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: t => {
          this.misTareas.set(t);
          if (this.mostrarModalMisTareas() && this.highlightedTaskId()) {
            if (this.scrollTimeoutId) {
              clearTimeout(this.scrollTimeoutId);
            }
            this.scrollTimeoutId = setTimeout(() => {
              const el = document.querySelector('.modal-mis-body .tarea-item.highlighted');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              this.scrollTimeoutId = null;
            }, 100);
          }
        },
        error: err => {
          console.error('[Tareas.cargarDatos.getMisTareas Error]', err);
          this.showError('No pudimos cargar tus tareas. Probá refrescando la página.');
        }
      });

    this.api.getTareas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: t => { this.todasTareas.set(t); this.loading.set(false); },
        error: err => {
          console.error('[Tareas.cargarDatos.getTareas Error]', err);
          this.loading.set(false);
          this.showError('No pudimos actualizar las tareas del hogar.');
        }
      });

    this.api.getDistribucionSemanal()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: d => this.distribucion.set(d),
        error: err => {
          console.error('[Tareas.cargarDatos.getDistribucionSemanal Error]', err);
          this.showError('No pudimos actualizar el gráfico semanal.');
        }
      });

    this.hogaresApi.getMiembros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => this.miembros.set(m),
        error: err => {
          console.error('[Tareas.cargarDatos.getMiembros Error]', err);
          this.showError('No pudimos cargar los miembros del hogar.');
        }
      });

    this.api.getProgreso().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this.applyProgress(p);
      },
      error: err => {
        console.error('[Tareas.cargarDatos.getProgreso Error]', err);
        this.showError('No pudimos cargar tu progreso y nivel.');
      }
    });
  }

  protected abrirModal(): void {
    this.nuevoTitulo = '';
    this.nuevaDescripcion = '';
    this.nuevaFechaLimite = '';
    this.nuevoAsignadoA = null;
    this.mostrarModal.set(true);
  }

  protected cerrarModal(): void {
    this.mostrarModal.set(false);
  }

  protected abrirModalAvatar(): void {
    this.mostrarModalAvatar.set(true);
  }

  protected cerrarModalAvatar(): void {
    this.mostrarModalAvatar.set(false);
  }

  protected abrirModalMisTareas(): void {
    this.mostrarModalMisTareas.set(true);
    if (this.misTareasConResaltada().length > 0 && this.highlightedTaskId()) {
      if (this.scrollTimeoutId) {
        clearTimeout(this.scrollTimeoutId);
      }
      this.scrollTimeoutId = setTimeout(() => {
        const el = document.querySelector('.modal-mis-body .tarea-item.highlighted');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        this.scrollTimeoutId = null;
      }, 100);
    }
  }

  protected cerrarModalMisTareas(): void {
    this.mostrarModalMisTareas.set(false);
    this.highlightedTaskId.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { taskId: null },
      queryParamsHandling: 'merge',
    });
  }

  protected guardarTarea(): void {
    if (!this.nuevoTitulo.trim() || this.guardando) return;
    this.guardando = true;

    this.api.createTarea({
      titulo: this.nuevoTitulo.trim(),
      descripcion: this.nuevaDescripcion.trim() || null,
      fechaLimite: this.nuevaFechaLimite || null,
      asignadoA: this.nuevoAsignadoA || null,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.guardando = false;
          this.cargarDatos();
        },
        error: err => {
          console.error('[Tareas.guardarTarea Error]', err);
          this.guardando = false;
          this.showError('No se pudo crear la tarea. Intentá de nuevo.');
        },
      });
  }

  protected completarTarea(tarea: TareaResponse): void {
    this.api.completarTarea(tarea.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(updated => {
          this.misTareas.update(ts => ts.filter(t => t.id !== updated.id));
          this.todasTareas.update(ts => ts.map(t => t.id === updated.id ? updated : t));

          // Gamificación
          if (updated.xpOtorgado !== null && updated.xpOtorgado !== undefined) {
            const floatingId = Date.now() + Math.random();
            this.floatingXPs.update(list => [...list, { id: floatingId, value: `+${updated.xpOtorgado} XP` }]);
            const timerId = setTimeout(() => {
              this.floatingXPs.update(list => list.filter(item => item.id !== floatingId));
              this.floatingXPTimers = this.floatingXPTimers.filter(t => t !== timerId);
            }, 1500);
            this.floatingXPTimers.push(timerId);
          }

          return forkJoin({
            distribucion: this.api.getDistribucionSemanal().pipe(
              catchError(err => {
                console.error('[Tareas.completarTarea.getDistribucionSemanal Error]', err);
                this.showError('No pudimos actualizar el gráfico semanal.');
                return of(null);
              })
            ),
            progreso: this.api.getProgreso().pipe(
              catchError(err => {
                console.error('[Tareas.completarTarea.getProgreso Error]', err);
                this.showError('No pudimos sincronizar tu progreso y nivel.');
                return of(null);
              })
            )
          });
        })
      )
      .subscribe({
        next: ({ distribucion, progreso }) => {
          if (distribucion) {
            this.distribucion.set(distribucion);
          }
          if (progreso) {
            const p = progreso;
            const previousLevel = this.nivel();
            const nextLevel = this.clampLevel(p.currentLevel);
            if (nextLevel > previousLevel && previousLevel < 5) {
              // Actualizar señales inmediatamente para prevenir carrera de timeouts
              this.applyProgress(p);
              this.evolucionando.set(true);
              if (this.levelUpTimeoutId) {
                clearTimeout(this.levelUpTimeoutId);
              }
              this.levelUpTimeoutId = setTimeout(() => {
                this.evolucionando.set(false);
                this.nivelCelebrado.set(Math.min(5, Math.max(1, nextLevel)));
                this.mostrarCelebracionLevelUp.set(true);
                this.levelUpTimeoutId = null;
              }, 2000);
            } else {
              this.applyProgress(p);
            }
          }
        },
        error: err => {
          console.error('[Tareas.completarTarea Error]', err);
          this.showError('No pudimos registrar la tarea como completada.');
        },
      });
  }

  protected eliminarTarea(id: string): void {
    this.api.deleteTarea(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.todasTareas.update(ts => ts.filter(t => t.id !== id));
          this.misTareas.update(ts => ts.filter(t => t.id !== id));
        },
        error: err => {
          console.error('[Tareas.eliminarTarea Error]', err);
          this.showError('No pudimos eliminar la tarea.');
        },
      });
  }

  protected toggleReasignacion(tareaId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.reasignandoTareaId() === tareaId) {
      this.cerrarReasignacion();
    } else {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.reasignandoTareaId.set(tareaId);
      this.reasignandoPos.set({ top: rect.bottom + 4, left: rect.left });
    }
  }

  protected cerrarReasignacion(): void {
    this.reasignandoTareaId.set(null);
    this.reasignandoPos.set(null);
  }

  protected reasignarTarea(tarea: TareaResponse, usuarioId: string | null): void {
    this.reasignandoTareaId.set(null);
    this.reasignandoPos.set(null);
    this.api.asignarTarea(tarea.id, usuarioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.todasTareas.update(ts => ts.map(t => t.id === updated.id ? updated : t));
          this.misTareas.update(ts => ts.map(t => t.id === updated.id ? updated : t));
        },
        error: err => {
          console.error('[Tareas.reasignarTarea Error]', err);
          this.showError('No pudimos reasignar la tarea.');
        },
      });
  }

  protected alturaBar(completadas: number): string {
    const max = this.maxCompletadas();
    if (completadas === 0 || max === 0) return '0px';
    const pct = (completadas / max) * 100;
    return `${pct}%`;
  }

  protected colorMiembro(index: number): string {
    return this.coloresMiembros[index % this.coloresMiembros.length];
  }

  protected badgeColor(nombre: string): string {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    return this.coloresMiembros[Math.abs(hash) % this.coloresMiembros.length];
  }

  protected formatFecha(fecha: string | null): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }

  protected formatFechaHora(fecha: string | null): string {
    if (!fecha) return '';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(fecha));
  }

  protected estaVencida(tarea: TareaResponse): boolean {
    return tarea.vencida;
  }

  protected estadoLabel(estado: string): string {
    return { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada' }[estado] ?? estado;
  }

}
