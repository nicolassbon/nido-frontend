import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  House, Refrigerator, ChefHat, Wallet,
  CheckSquare, Calendar, Zap, Bell,
  User, Settings, LogOut, Plus,
  AlertTriangle, TrendingUp, ArrowRight,
  ShoppingBasket, ClipboardList, Info
} from 'lucide-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(routes),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        House, Refrigerator, ChefHat, Wallet,
        CheckSquare, Calendar, Zap, Bell,
        User, Settings, LogOut, Plus,
        AlertTriangle, TrendingUp, ArrowRight,
        ShoppingBasket, ClipboardList, Info
      })
    }
  ],
};
