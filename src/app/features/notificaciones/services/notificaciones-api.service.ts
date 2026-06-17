import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, Subscription, interval, startWith, switchMap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

export interface NotificacionResponse {
  id: string;
  usuarioId: string;
  tipo: string | null;
  mensaje: string | null;
  leida: boolean;
  referenciaId: string | null;
  referenciaTipo: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesApiService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  public readonly notificaciones = signal<NotificacionResponse[]>([]);
  public readonly unreadCount = signal<number>(0);

  private pollSubscription?: Subscription;

  getNotificaciones(): Observable<NotificacionResponse[]> {
    return this.http.get<NotificacionResponse[]>(`${this.base}/notificaciones`).pipe(
      tap(list => {
        this.notificaciones.set(list);
        const count = list.filter(n => !n.leida).length;
        this.unreadCount.set(count);
      })
    );
  }

  actualizarContador(): void {
    this.getNotificaciones().subscribe();
  }

  iniciarPolleo(intervalMs: number = 30000): void {
    this.detenerPolleo();
    this.pollSubscription = interval(intervalMs)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (this.auth.isAuthenticated()) {
            return this.getNotificaciones();
          }
          return of([]);
        })
      )
      .subscribe();
  }

  detenerPolleo(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = undefined;
    }
  }

  marcarComoLeida(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notificaciones/${id}/leer`, {}).pipe(
      tap(() => {
        this.unreadCount.update(c => Math.max(0, c - 1));
      })
    );
  }

  marcarTodasComoLeidas(): Observable<void> {
    return this.http.post<void>(`${this.base}/notificaciones/leer-todas`, {}).pipe(
      tap(() => {
        this.unreadCount.set(0);
      })
    );
  }

  eliminarNotificacion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/notificaciones/${id}`);
  }

  ngOnDestroy(): void {
    this.detenerPolleo();
  }
}
