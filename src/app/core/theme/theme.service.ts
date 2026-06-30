import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'nido-theme-mode';

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
    }
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
  }

  private getStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem(this.THEME_KEY) as ThemeMode;
    return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
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
