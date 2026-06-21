import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Bell, Users, Wrench, Box, Trash2, ChevronDown, Check, Calendar,
} from 'lucide-angular';
import { NotificacionesApiService, NotificacionResponse } from './services/notificaciones-api.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.scss',
})
export class Notificaciones implements OnInit {
  private readonly api = inject(NotificacionesApiService);
  private readonly router = inject(Router);

  protected readonly icons = {
    Bell, Users, Wrench, Box, Trash2, ChevronDown, Check, Calendar,
  };

  protected readonly notificaciones = this.api.notificaciones;
  protected readonly loading = signal(false);
  protected readonly filtroActual = signal<'todas' | 'no-leidas'>('todas');
  protected readonly mostrarFiltros = signal(false);

  protected readonly notificacionesFiltradas = computed(() => {
    const list = this.notificaciones();
    const filtro = this.filtroActual();
    if (filtro === 'no-leidas') {
      return list.filter(n => !n.leida);
    }
    return list;
  });

  protected readonly countNoLeidas = computed(() =>
    this.notificaciones().filter(n => !n.leida).length
  );

  ngOnInit(): void {
    this.cargarDatos();
  }

  protected cargarDatos(): void {
    this.loading.set(true);
    this.api.getNotificaciones().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleFiltros(): void {
    this.mostrarFiltros.update(v => !v);
  }

  protected setFiltro(filtro: 'todas' | 'no-leidas'): void {
    this.filtroActual.set(filtro);
    this.mostrarFiltros.set(false);
  }

  protected marcarComoLeida(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.api.marcarComoLeida(id).subscribe({
      next: () => {
        this.notificaciones.update(list =>
          list.map(n => n.id === id ? { ...n, leida: true } : n)
        );
      },
    });
  }

  protected marcarTodasLeidas(): void {
    this.api.marcarTodasComoLeidas().subscribe({
      next: () => {
        this.notificaciones.update(list =>
          list.map(n => ({ ...n, leida: true }))
        );
      },
    });
  }

  protected eliminar(id: string, event: MouseEvent): void {
    event.stopPropagation();
    const notif = this.notificaciones().find(n => n.id === id);
    this.api.eliminarNotificacion(id).subscribe({
      next: () => {
        this.notificaciones.update(list => list.filter(n => n.id !== id));
        if (notif && !notif.leida) {
          this.api.unreadCount.update(c => Math.max(0, c - 1));
        }
      },
    });
  }

  protected verRecurso(n: NotificacionResponse): void {
    if (!n.leida) {
      this.api.marcarComoLeida(n.id).subscribe({
        next: () => {
          this.notificaciones.update(list =>
            list.map(notif => notif.id === n.id ? { ...notif, leida: true } : notif)
          );
        }
      });
    }

    if (n.referenciaTipo === 'alacena' && n.referenciaId) {
      this.router.navigate(['/alacena', n.referenciaId]);
    } else if (n.referenciaTipo === 'tarea' && n.referenciaId) {
      this.router.navigate(['/tareas'], { queryParams: { taskId: n.referenciaId } });
    } else {
      this.router.navigate(['/tareas']);
    }
  }

  protected getCategoriaTitle(tipo: string | null, mensaje: string | null): string {
    if (tipo === 'asignacion_tarea') return 'Tarea Familiar';
    if (tipo === 'tarea_vencida' || tipo === 'producto_vencido' || tipo === 'producto_por_vencer') return 'Vencimiento';
    if (tipo === 'stock_bajo') return 'Alerta de Stock';
    if (mensaje?.toLowerCase().includes('mantenimiento')) return 'Mantenimiento';
    if (mensaje?.toLowerCase().includes('stock') || mensaje?.toLowerCase().includes('inventario') || mensaje?.toLowerCase().includes('agotarse')) return 'Alerta de Stock';
    return 'Notificación';
  }

  protected getIconName(tipo: string | null, mensaje: string | null): any {
    const title = this.getCategoriaTitle(tipo, mensaje);
    if (title === 'Tarea Familiar') return this.icons.Users;
    if (title === 'Vencimiento') return this.icons.Calendar;
    if (title === 'Mantenimiento') return this.icons.Wrench;
    if (title === 'Alerta de Stock') return this.icons.Box;
    return this.icons.Bell;
  }

  protected getIconBgClass(tipo: string | null, mensaje: string | null): string {
    const title = this.getCategoriaTitle(tipo, mensaje);
    if (title === 'Tarea Familiar') return 'bg-[#B48B6A]/20 text-[#7A5A45]';
    if (title === 'Vencimiento') return 'bg-[#b44c3c]/20 text-[#b44c3c]';
    if (title === 'Mantenimiento') return 'bg-[#7A5A45]/20 text-[#7A5A45]';
    if (title === 'Alerta de Stock') return 'bg-[#9a806c]/20 text-[#2D1E16]';
    return 'bg-nido-border/30 text-nido-green-dark';
  }

  protected formatFecha(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);

    let timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (diffMins < 1) return `Hace unos instantes | ${timeStr}`;
    if (diffMins < 60) return `Hace ${diffMins} min | ${timeStr}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'} | ${timeStr}`;
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} | ${timeStr}`;
  }
}
