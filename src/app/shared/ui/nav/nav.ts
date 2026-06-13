import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule, LucideIconData,
  House, Refrigerator, ChefHat, Wallet,
  CheckSquare, Calendar, Zap, Bell,
  User, Settings, LogOut, ShoppingCart,
} from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon:  string;
  disabled?: boolean;
}

@Component({
  selector:    'app-nav',
  imports:     [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './nav.html',
  styleUrl:    './nav.scss',
})
export class Nav {
  private readonly authService = inject(AuthService);

  readonly isOpen = input(false);

  protected readonly sidebarClass = computed(() => {
    const base = [
      'nido-sidebar w-[230px] h-screen overflow-y-auto bg-nido-green-dark flex flex-col px-3 py-6 shrink-0',
      'transition-transform duration-[280ms] ease-out',
      'fixed top-0 left-0 z-[100]',
      'md:sticky md:top-0 md:translate-x-0 md:shadow-none',
    ].join(' ');

    return this.isOpen()
      ? `${base} translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.35)]`
      : `${base} -translate-x-full`;
  });

  protected readonly mainNavItems: NavItem[] = [
    { label: 'Inicio',            route: '/inicio',           icon: 'house'       },
    { label: 'Alacena',           route: '/alacena',          icon: 'refrigerator'},
    { label: 'Recetas',           route: '/recetas',          icon: 'chef-hat'      },
    { label: 'Lista de compras',  route: '/lista-compras',    icon: 'shopping-cart' },
    { label: 'Finanzas',          route: '/finanzas',         icon: 'wallet',       disabled: true },
    { label: 'Tareas',            route: '/tareas',           icon: 'check-square' },
    { label: 'Planificador',      route: '/planificador',     icon: 'calendar',     disabled: true },
    { label: 'Electrodomésticos', route: '/electrodomesticos',icon: 'zap'         },
    { label: 'Notificaciones',    route: '/notificaciones',   icon: 'bell',         disabled: true },
    { label: 'Mi perfil',         route: '/perfil',           icon: 'user'        },
  ];

  protected readonly bottomNavItems: NavItem[] = [
    { label: 'Configuración', route: '/configuracion', icon: 'settings' },
  ];

  protected logout(): void {
    this.authService.logout().subscribe();
  }

  protected readonly icons: Record<string, LucideIconData> = {
    'house':        House,
    'refrigerator': Refrigerator,
    'chef-hat':     ChefHat,
    'wallet':       Wallet,
    'check-square': CheckSquare,
    'calendar':     Calendar,
    'zap':          Zap,
    'bell':         Bell,
    'user':         User,
    'settings':     Settings,
    'shopping-cart': ShoppingCart,
    'log-out':       LogOut,
  };
}
