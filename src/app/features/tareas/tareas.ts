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
  CheckSquare, ClipboardList, History,
} from 'lucide-angular';
import { TareasApiService, TareaResponse, DistribucionSemanalResponse } from './services/tareas-api.service';
import { HogaresApiService, MiembroResponse } from '../household/hogares-api.service';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';

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

  protected readonly icons = {
    Plus, Check, X, Calendar, ChevronRight, ChevronDown, Clock, AlertCircle,
    CheckSquare, ClipboardList, History,
  };

  // ── Estado principal ─────────────────────────────────────
  protected readonly misTareas = signal<TareaResponse[]>([]);
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
  protected readonly highlightedTaskId = signal<string | null>(null);
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
    if (!d) return 1;
    let max = 0;
    for (const dia of d.dias) {
      for (const m of dia.miembros) {
        if (m.completadas > max) max = m.completadas;
      }
    }
    return Math.max(max, 1);
  });

  protected readonly coloresMiembros = [
    '#B48B6A', '#7A5A45', '#9a806c', '#c4956a', '#8B6E58', '#6B4E3D',
  ];

  ngOnInit(): void {
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
  }

  private cargarDatos(): void {
    this.loading.set(true);
    this.api.getMisTareas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: t => {
          this.misTareas.set(t);
          if (this.mostrarModalMisTareas() && this.highlightedTaskId()) {
            setTimeout(() => {
              const el = document.querySelector('.modal-mis-body .tarea-item.highlighted');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        },
        error: () => {}
      });

    this.api.getTareas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => { this.todasTareas.set(t); this.loading.set(false); }, error: () => this.loading.set(false) });

    this.api.getDistribucionSemanal()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: d => this.distribucion.set(d), error: () => {} });

    this.hogaresApi.getMiembros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: m => this.miembros.set(m), error: () => {} });
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

  protected abrirModalMisTareas(): void {
    this.mostrarModalMisTareas.set(true);
    if (this.misTareasConResaltada().length > 0 && this.highlightedTaskId()) {
      setTimeout(() => {
        const el = document.querySelector('.modal-mis-body .tarea-item.highlighted');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
        error: () => { this.guardando = false; },
      });
  }

  protected completarTarea(tarea: TareaResponse): void {
    this.api.completarTarea(tarea.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.misTareas.update(ts => ts.filter(t => t.id !== updated.id));
          this.todasTareas.update(ts => ts.map(t => t.id === updated.id ? updated : t));
          this.api.getDistribucionSemanal()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: d => this.distribucion.set(d), error: () => {} });
        },
        error: () => {},
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
        error: () => {},
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
        error: () => {},
      });
  }

  protected alturaBar(completadas: number): string {
    if (completadas === 0) return '0px';
    const pct = (completadas / this.maxCompletadas()) * 100;
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
