import {
  Component, OnInit, DestroyRef, inject, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideAngularModule, Plus, Check, X, Trash2, User,
  Calendar, ChevronRight, ChevronDown, LayoutGrid, List, Clock, AlertCircle,
  CheckSquare, ClipboardList,
} from 'lucide-angular';
import { TareasApiService, TareaResponse, DistribucionSemanalResponse } from './services/tareas-api.service';
import { HogaresApiService, MiembroResponse } from '../household/hogares-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { NidoDatepickerComponent } from '../../shared/ui/form/nido-datepicker/nido-datepicker';
import { NidoSelectComponent, NidoSelectOption } from '../../shared/ui/form/nido-select/nido-select';

type Vista = 'lista' | 'tablero';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, NidoDatepickerComponent, NidoSelectComponent],
  templateUrl: './tareas.html',
  styleUrl: './tareas.scss',
})
export class Tareas implements OnInit {
  private readonly api = inject(TareasApiService);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = {
    Plus, Check, X, Trash2, User, Calendar, ChevronRight, ChevronDown, LayoutGrid, List, Clock, AlertCircle,
    CheckSquare, ClipboardList,
  };

  // ── Estado principal ─────────────────────────────────────
  protected readonly misTareas = signal<TareaResponse[]>([]);
  protected readonly todasTareas = signal<TareaResponse[]>([]);
  protected readonly distribucion = signal<DistribucionSemanalResponse | null>(null);
  protected readonly miembros = signal<MiembroResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly vistaActual = signal<Vista>('lista');
  protected readonly filtroAsignado = signal<string | null>(null);
  protected readonly mostrarModal = signal(false);
  protected readonly mostrarModalMisTareas = signal(false);
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
      .slice(0, 4)
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

  // ── Usuario actual ───────────────────────────────────────
  protected readonly nombreUsuario = computed(() => this.authService.getNombre() ?? '');

  // ── Tablero: tareas filtradas por columna ────────────────
  private readonly tareasFiltradas = computed(() => {
    const filtro = this.filtroAsignado();
    return filtro
      ? this.todasTareas().filter(t => t.asignadoA?.usuarioId === filtro)
      : this.todasTareas();
  });

  protected readonly pendientes = computed(() =>
    this.tareasFiltradas().filter(t => t.estado === 'pendiente'));
  protected readonly enProgreso = computed(() =>
    this.tareasFiltradas().filter(t => t.estado === 'en_progreso'));
  protected readonly completadasTablero = computed(() =>
    this.tareasFiltradas().filter(t => t.estado === 'completada'));

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
  }

  private cargarDatos(): void {
    this.loading.set(true);
    this.api.getMisTareas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: t => this.misTareas.set(t), error: () => {} });

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

  protected cambiarVista(v: Vista): void {
    this.vistaActual.set(v);
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
  }

  protected cerrarModalMisTareas(): void {
    this.mostrarModalMisTareas.set(false);
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
        },
        error: () => {},
      });
  }

  protected cambiarEstado(tarea: TareaResponse, estado: string): void {
    this.api.updateTarea(tarea.id, { estado })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.todasTareas.update(ts => ts.map(t => t.id === updated.id ? updated : t));
          if (estado === 'completada') {
            this.misTareas.update(ts => ts.filter(t => t.id !== updated.id));
          }
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

  protected setFiltro(usuarioId: string | null): void {
    this.filtroAsignado.set(usuarioId);
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

  protected estaVencida(tarea: TareaResponse): boolean {
    return tarea.vencida;
  }

  protected estadoLabel(estado: string): string {
    return { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada' }[estado] ?? estado;
  }

  protected estadoSiguiente(estado: string): string | null {
    return { pendiente: 'en_progreso', en_progreso: 'completada', completada: null }[estado] ?? null;
  }
}
