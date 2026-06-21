import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Nav } from '../../shared/ui/nav/nav';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Nav],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private readonly router = inject(Router);

  protected readonly isMenuOpen = signal(false);

  constructor() {
    // En mobile el menú se desliza por encima del contenido: al navegar
    // hay que cerrarlo, si no queda abierto tapando la página destino.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
