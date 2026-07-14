import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Nav } from '../../shared/ui/nav/nav';
import { PaywallModalComponent } from '../../shared/ui/paywall-modal/paywall-modal';
import { AuthService } from '../auth/auth.service';
import { PaywallService } from '../servicios/paywall';
import { CommonModule } from '@angular/common';
import { ContextualTutorialService } from '../tutorial/contextual-tutorial.service';
import { LucideAngularModule } from 'lucide-angular';
import { PostPaymentReturnService } from '../post-payment-return';

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
  protected readonly tutorial = inject(ContextualTutorialService);
  private readonly postPaymentReturn = inject(PostPaymentReturnService);

  protected readonly isMenuOpen = signal(false);
  protected readonly currentRoute = signal(this.router.url);

  protected readonly isExpired = this.authService.hasExpiredPremium;
  protected readonly paymentSuccessFlash = this.postPaymentReturn.successFlash;

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

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.tutorial.handleRoute((event as NavigationEnd).urlAfterRedirects));

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.handlePaymentFlashNavigation((event as NavigationEnd).urlAfterRedirects));

    window.setTimeout(() => this.tutorial.handleRoute(this.router.url), 0);
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected startHelp(): void {
    this.tutorial.startCurrentManually();
  }

  protected dismissPaymentSuccessFlash(): void {
    this.postPaymentReturn.dismissSuccessFlash();
  }

  protected handlePaymentFlashNavigation(url: string): void {
    this.currentRoute.set(url);
    const flash = this.paymentSuccessFlash();
    if (flash && url !== flash.origin) {
      this.dismissPaymentSuccessFlash();
    }
  }
}
