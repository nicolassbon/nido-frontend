import { Routes } from '@angular/router';
import { Layout } from './core/layout/layout';
import { Home } from './features/home/home/home';
import { Recipes } from './features/recipes/recipes/recipes';
import { Alacena } from './features/alacena/alacena/alacena';
import { Electrodomesticos } from './features/electrodomesticos/electrodomesticos';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: Home },
      { path: 'recetas', component: Recipes },
      { path: 'alacena', component: Alacena },
      { path: 'electrodomesticos', component: Electrodomesticos },
    ],
  },
  { path: '**', redirectTo: '' },
];
