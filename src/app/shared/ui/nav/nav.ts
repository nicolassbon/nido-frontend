import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, LucideIconData, House, Refrigerator, ChefHat, Wallet, CheckSquare, Calendar, Zap, Bell, User, Settings, LogOut } from 'lucide-angular';
interface NavItem {
  label: string;
  route: string;
  icon: string;
}
@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './nav.html',
  styleUrl: './nav.scss',
})

export class Nav {
  protected readonly isMenuOpen = signal(false);

  protected readonly mainNavItems: NavItem[] = [
    { label: 'Inicio', route: '/inicio', icon: 'house' },
    { label: 'Alacena', route: '/alacena', icon: 'refrigerator' },
    { label: 'Recetas', route: '/recetas', icon: 'chef-hat' },
    { label: 'Finanzas', route: '/finanzas', icon: 'wallet' },
    { label: 'Tareas', route: '/tareas', icon: 'check-square' },
    { label: 'Planificador', route: '/planificador', icon: 'calendar' },
    { label: 'Electrodomésticos', route: '/electrodomesticos', icon: 'zap' },
    { label: 'Notificaciones', route: '/notificaciones', icon: 'bell' },
    { label: 'Mi perfil', route: '/perfil', icon: 'user' },
  ];

  protected readonly bottomNavItems: NavItem[] = [
    { label: 'Configuración', route: '/configuracion', icon: 'settings' },
    { label: 'Salir', route: '/salir', icon: 'log-out' },
  ];

  protected readonly icons: Record<string, LucideIconData> = {
    'house': House,
    'refrigerator': Refrigerator,
    'chef-hat': ChefHat,
    'wallet': Wallet,
    'check-square': CheckSquare,
    'calendar': Calendar,
    'zap': Zap,
    'bell': Bell,
    'user': User,
    'settings': Settings,
    'log-out': LogOut,
  };
}
