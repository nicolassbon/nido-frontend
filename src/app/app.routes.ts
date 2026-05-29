import { Routes } from '@angular/router';
import { Layout } from './core/layout/layout';
import { Home } from './features/home/home/home';
import { Recipes } from './features/recipes/recipes/recipes';
import { Alacena } from './features/alacena/alacena/alacena';
import { CreateHousehold } from './features/household/create-household/create-household';
import { AcceptInvitation } from './features/household/accept-invitation/accept-invitation';
import { WellnessStep } from './features/onboarding/wellness-step/wellness-step';

export const routes: Routes = [
  { path: 'crear-hogar',     component: CreateHousehold },
  { path: 'finalizar-hogar', component: WellnessStep },
  { path: 'invitacion',      component: AcceptInvitation },
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: Home },
      { path: 'recetas', component: Recipes },
      { path: 'alacena', component: Alacena },
    ],
  },
  { path: '**', redirectTo: '' },
];
