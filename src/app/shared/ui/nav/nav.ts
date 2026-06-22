import { Component, computed, inject, input, output, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule, LucideIconData,
  House, Refrigerator, ChefHat, Wallet,
  CheckSquare, Calendar, Zap, Bell,
  User, Settings, LogOut, ShoppingCart, X,
} from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacionesApiService } from '../../../features/notificaciones/services/notificaciones-api.service';

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
export class Nav implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly notificacionesApi = inject(NotificacionesApiService);

  readonly isOpen = input(false);
  readonly close = output<void>();

  protected readonly unreadNotificationsCount = this.notificacionesApi.unreadCount;

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.notificacionesApi.iniciarPolleo(30000);
    }
  }

  ngOnDestroy(): void {
    this.notificacionesApi.detenerPolleo();
  }

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
    { label: 'Finanzas',          route: '/finanzas',         icon: 'wallet'        },
    { label: 'Tareas',            route: '/tareas',           icon: 'check-square' },
    { label: 'Planificador',      route: '/planificador',     icon: 'calendar' },
    { label: 'Electrodomésticos', route: '/electrodomesticos',icon: 'zap'         },
    { label: 'Notificaciones',    route: '/notificaciones',   icon: 'bell'        },
    { label: 'Mi perfil',         route: '/perfil',           icon: 'user'        },
  ];

  protected readonly bottomNavItems: NavItem[] = [
    { label: 'Configuración', route: '/configuracion', icon: 'settings' },
  ];

  protected logout(): void {
    this.authService.logout().subscribe();
  }

  protected readonly icons: Record<string, LucideIconData> = {
    'x':            X,
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
