import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';

interface StatCard {
  value: string;
  label: string;
  icon: string;
}

interface QuickAction {
  label: string;
  icon: string;
  route: string;
  accent: string;
}

interface Alert {
  message: string;
  detail: string;
  type: 'warning' | 'info' | 'success';
  icon: string;
}

interface PendingTask {
  title: string;
  tag: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly authService = inject(AuthService);

  protected readonly greeting = signal(this.buildGreeting());
  protected readonly userName = signal(this.authService.getNombre() ?? 'vos');
  protected readonly today = signal(
    new Date().toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  );

  protected readonly stats: StatCard[] = [
    { value: '87', label: 'Productos en stock', icon: 'shopping-basket' },
    { value: '$20.300', label: 'Gasto mensual', icon: 'trending-up' },
    { value: '4', label: 'Tareas pendientes', icon: 'clipboard-list' },
  ];

  protected readonly quickActions: QuickAction[] = [
    { label: 'Agregar a alacena', icon: 'refrigerator', route: '/alacena', accent: '#3E5E4A' },
    { label: 'Nueva receta', icon: 'chef-hat', route: '/recetas', accent: '#C78F5A' },
    { label: 'Nueva tarea', icon: 'check-square', route: '/tareas', accent: '#927357' },
    { label: 'Ver finanzas', icon: 'wallet', route: '/finanzas', accent: '#3E5E4A' },
    { label: 'Planificar comidas', icon: 'calendar', route: '/planificador', accent: '#C78F5A' },
    { label: 'Electrodomésticos', icon: 'zap', route: '/electrodomesticos', accent: '#927357' },
  ];

  protected readonly alerts: Alert[] = [
    {
      message: '3 productos vencen esta semana',
      detail: 'Leche, yogur y queso crema',
      type: 'warning',
      icon: 'alert-triangle',
    },
    {
      message: 'Presupuesto mensual al 78%',
      detail: 'Llevás $20.300 de $26.000',
      type: 'warning',
      icon: 'trending-up',
    },
    {
      message: 'Plan de comidas incompleto',
      detail: 'Faltan 3 días sin planificar',
      type: 'info',
      icon: 'info',
    },
    {
      message: 'Alacena bien abastecida',
      detail: '87 productos disponibles',
      type: 'success',
      icon: 'check-square',
    },
  ];

  protected readonly pendingTasks: PendingTask[] = [
    { title: 'Comprar leche y huevos', tag: 'Alacena' },
    { title: 'Limpiar heladera', tag: 'Hogar' },
    { title: 'Pagar servicios', tag: 'Finanzas' },
    { title: 'Revisar microondas', tag: 'Electrodomésticos' },
  ];

  protected alertContainerClass(type: 'warning' | 'info' | 'success'): string {
    const base = 'flex items-start gap-3 rounded-[10px] border-l-[3px] border-solid px-4 py-3.5';
    if (type === 'warning') return `${base} bg-[rgba(199,143,90,0.1)] border-l-nido-gold`;
    if (type === 'info')    return `${base} bg-[rgba(62,94,74,0.08)] border-l-nido-green`;
    return `${base} bg-[rgba(38,63,48,0.07)] border-l-nido-green-dark`;
  }

  protected alertIconClass(type: 'warning' | 'info' | 'success'): string {
    if (type === 'warning') return 'text-nido-gold';
    if (type === 'info')    return 'text-nido-green';
    return 'text-nido-green-dark';
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
