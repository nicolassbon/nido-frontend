import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Nav } from '../../shared/ui/nav/nav';
import { PaywallModalComponent } from '../../shared/ui/paywall-modal/paywall-modal';
import { AuthService } from '../auth/auth.service';
import { PaywallService } from '../servicios/paywall';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Nav, PaywallModalComponent, CommonModule, LucideAngularModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly paywall = inject(PaywallService);

  protected readonly isMenuOpen = signal(false);

  protected readonly isExpired = this.authService.hasExpiredPremium;

  protected openPaywall(): void {
    this.paywall.open();
  }

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
