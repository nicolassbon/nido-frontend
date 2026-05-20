import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  LUCIDE_ICONS, LucideIconProvider,
  House, Refrigerator, ChefHat, Wallet,
  CheckSquare, Calendar, Zap, Bell,
  User, Settings, LogOut, Plus,
  AlertTriangle, TrendingUp, ArrowRight,
  ShoppingBasket, ClipboardList, Info,
  Search, Clock, Flame, Star, Shuffle,
  ChevronDown, X, SlidersHorizontal, Pencil,
  Shield, Check, QrCode, Snowflake, Package,
  Tag, AlertCircle,
  // Alacena
  Scan, ScanLine, SearchX, CalendarClock, CalendarCheck,
  PackageOpen, LockOpen, Minus, Camera,
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
        ShoppingBasket, ClipboardList, Info,
        Search, Clock, Flame, Star, Shuffle,
        ChevronDown, X, SlidersHorizontal, Pencil,
        Shield, Check, QrCode, Snowflake, Package,
        Tag, AlertCircle,
        Scan, ScanLine, SearchX, CalendarClock, CalendarCheck,
        PackageOpen, LockOpen, Minus, Camera,
      })
    }
  ],
};
