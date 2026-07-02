import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly THEME_KEY = 'nido-theme-mode';
  private readonly TOKEN_KEY = 'accessToken';
  private readonly AUTH_TOKEN_CHANGED_EVENT = 'nido-auth-token-changed';
  private readonly base = environment.apiBaseUrl;

  // Almacenar el modo de tema en un Signal de Angular
  readonly themeMode = signal<ThemeMode>(this.getStoredTheme());

  constructor() {
    // Sincronizar automáticamente los cambios del Signal al localStorage y al DOM
    effect(() => {
      const mode = this.themeMode();
      this.applyTheme(mode);
      localStorage.setItem(this.THEME_KEY, mode);
    });

    // Escuchar cambios en las preferencias del sistema operativo si estamos en modo 'system'
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.themeMode() === 'system') {
          this.applyTheme('system');
        }
      });

      window.addEventListener(this.AUTH_TOKEN_CHANGED_EVENT, () => this.syncFromRemote());
    }
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    this.persistRemoteTheme(mode);
  }

  syncFromRemote(): void {
    if (!this.canSyncRemote()) return;

    this.http.get<{ temaPreferido?: string }>(`${this.base}/preferencias/usuario`)
      .subscribe({
        next: (prefs) => {
          if (this.isThemeMode(prefs.temaPreferido)) {
            this.themeMode.set(prefs.temaPreferido);
          }
        },
        error: () => {},
      });
  }

  private getStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(this.THEME_KEY) as ThemeMode;
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
  }

  private persistRemoteTheme(mode: ThemeMode): void {
    if (!this.canSyncRemote()) return;

    this.http.patch(`${this.base}/preferencias/usuario`, { temaPreferido: mode })
      .subscribe({
        error: () => {},
      });
  }

  private canSyncRemote(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem(this.TOKEN_KEY);
  }

  private isThemeMode(value: unknown): value is ThemeMode {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private applyTheme(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;

    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'system') {
      isDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const htmlEl = document.documentElement;
    if (isDark) {
      htmlEl.classList.add('dark');
    } else {
      htmlEl.classList.remove('dark');
    }
  }
}
