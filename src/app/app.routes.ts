import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard } from './core/guards/auth';
import { premiumGuard } from './core/guards/premium';
import { Layout } from './core/layout/layout';
import { Home } from './features/home/home/home';
import { Recipes } from './features/recipes/recipes/recipes';
import { RecipeDetail } from './features/recipes/recipe-detail/recipe-detail';
import { Alacena } from './features/alacena/alacena/alacena';
import { ProductDetail } from './features/alacena/product-detail/product-detail';
import { TicketScan } from './features/alacena/ticket-scan/ticket-scan';
import { NutritionScan } from './features/alacena/nutrition-scan/nutrition-scan';
import { ListaCompras } from './features/lista-compras/lista-compras';
import { CreateHousehold } from './features/household/create-household/create-household';
import { AcceptInvitation } from './features/household/accept-invitation/accept-invitation';
import { WellnessStep } from './features/onboarding/wellness-step/wellness-step';
import { Electrodomesticos } from './features/electrodomesticos/electrodomesticos';
import { PerfilComponent } from './features/perfil/perfil';
import { AgregarProducto } from './features/agregar-producto/agregar-producto';
import { Register } from './features/auth/register/register';
import { Login } from './features/auth/login/login';
import { EquipmentStep } from './features/onboarding/equipment-step/equipment-step';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Configuracion } from './features/configuracion/configuracion';
import { Estadisticas } from './features/estadisticas/estadisticas';
import { Landing } from './features/landing/landing';
import { Finanzas } from './features/finanzas/finanzas/finanzas';
import { Tareas } from './features/tareas/tareas';
import { Notificaciones } from './features/notificaciones/notificaciones';
import { Planificador } from './features/planificador/planificador/planificador';

export const routes: Routes = [
  { path: '', component: Landing, pathMatch: 'full', canActivate: [guestGuard] },
  { path: 'login',           component: Login },
  { path: 'registro',        component: Register },
  { path: 'olvidaste-contrasena', component: ForgotPassword },
  { path: 'restablecer-contrasena', component: ResetPassword },
  { path: 'crear-hogar',     component: CreateHousehold, canActivate: [authGuard] },
  { path: 'equipamiento', component: EquipmentStep, canActivate: [authGuard] },
  { path: 'finalizar-hogar', component: WellnessStep, canActivate: [authGuard] },
  { path: 'invitacion',      component: AcceptInvitation },
  {
    path: '',
    component: Layout,
    canActivateChild: [authChildGuard],
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: Home },
      { path: 'recetas', component: Recipes },
      { path: 'recetas/:id',    component: RecipeDetail  },
      { path: 'alacena',        component: Alacena       },
      { path: 'alacena/escanear-ticket', component: TicketScan, canActivate: [premiumGuard] },
      { path: 'alacena/:id/informacion-nutricional', component: NutritionScan, canActivate: [premiumGuard] },
      { path: 'alacena/:id',    component: ProductDetail },
      { path: 'lista-compras',  component: ListaCompras  },
      { path: 'electrodomesticos', component: Electrodomesticos },
      { path: 'estadisticas', component: Estadisticas },
      { path: 'perfil', component: PerfilComponent },
      { path: 'configuracion', component: Configuracion },
      { path: 'agregar-producto', component: AgregarProducto },
      { path: 'finanzas', component: Finanzas },
      { path: 'tareas', component: Tareas },
      { path: 'notificaciones', component: Notificaciones },
      { path: 'planificador', component: Planificador },
    ],
  },
  { path: '**', redirectTo: '' },
];
