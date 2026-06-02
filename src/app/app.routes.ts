import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard } from './core/guards/auth';
import { Layout } from './core/layout/layout';
import { Home } from './features/home/home/home';
import { Recipes } from './features/recipes/recipes/recipes';
import { RecipeDetail } from './features/recipes/recipe-detail/recipe-detail';
import { Alacena } from './features/alacena/alacena/alacena';
import { ProductDetail } from './features/alacena/product-detail/product-detail';
import { ListaCompras } from './features/lista-compras/lista-compras';
import { CreateHousehold } from './features/household/create-household/create-household';
import { AcceptInvitation } from './features/household/accept-invitation/accept-invitation';
import { WellnessStep } from './features/onboarding/wellness-step/wellness-step';
import { Electrodomesticos } from './features/electrodomesticos/electrodomesticos';
import { PerfilComponent } from './features/perfil/perfil';
import { EditarPerfil } from './features/editar-perfil/editar-perfil';
import { AgregarProducto } from './features/agregar-producto/agregar-producto';
import { Register } from './features/auth/register/register';
import { Login } from './features/auth/login/login';
import { EquipmentStep } from './features/onboarding/equipment-step/equipment-step';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Configuracion } from './features/configuracion/configuracion';
import { Landing } from './features/landing/landing';

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
      { path: 'alacena/:id',    component: ProductDetail },
      { path: 'lista-compras',  component: ListaCompras  },
      { path: 'electrodomesticos', component: Electrodomesticos },
      { path: 'perfil', component: PerfilComponent },
      { path: 'perfil/editar', component: EditarPerfil },
      { path: 'configuracion', component: Configuracion },
      { path: 'agregar-producto', component: AgregarProducto },
    ],
  },
  { path: '**', redirectTo: '' },
];
