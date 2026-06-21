import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  AlarmClock,
  AlertTriangle,
  Bookmark,
  Check,
  CheckSquare,
  ChevronDown,
  ChefHat,
  Clock,
  Eye,
  Flame,
  LucideAngularModule,
  Pencil,
  Search,
  Shield,
  ShoppingBasket,
  Shuffle,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from 'lucide-angular';
import { ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';
import { HogaresApiService, MiembroResponse } from '../../household/hogares-api.service';
import { environment } from '../../../../environments/environment';
import { ApiReceta, RecipesApiService } from './services/recipes-api.service';
import { StarRatingComponent } from '../../../shared/ui/star-rating/star-rating';
import { ProductService } from '../../../core/servicios/agregar-producto.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PerfilApiService } from '../../perfil/perfil-api.service';

type Difficulty = 'Fácil' | 'Medio' | 'Difícil';
type FilterOption = 'Todos' | 'Guardadas' | Difficulty;
type SortOption = 'default' | 'rating' | 'coincidencia' | 'urgencia';

interface RecipeIngredient {
  name: string;
  inStock: boolean;
  allergenTypes: string[];
}

interface ExpiringRecipeProduct {
  productId: string;
  name: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

interface Recipe {
  id: string;
  name: string;
  image: string;
  rating: number;
  ratingCount: number;
  difficulty: Difficulty;
  timeMinutes: number;
  calories: number;
  ingredients: RecipeIngredient[];
  requiredAppliances: string[];
  vecesCocinada: number;
  tieneProductosPorVencer: boolean;
  fechaVencimientoMasProxima: string | null;
  diasHastaVencimiento: number | null;
  productosPorVencer: ExpiringRecipeProduct[];
  guardada: boolean;
}

interface RecipeWithAvailability extends Recipe {
  availabilityPercent: number;
  hasAllergen: boolean;
  hasMissingAppliance: boolean;
}

interface PantryIngredient {
  name: string;
  amount: string;
  selected: boolean;
}

interface HouseholdMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  allergens: string[];
}

const MEMBER_COLORS = ['#3E5E4A', '#B48B6A', '#927357', '#263F30', '#b44c3c', '#5f6f52'];

const ALLERGEN_ALIASES: Record<string, string[]> = {
  'Maní': ['mani', 'cacahuate', 'peanut', 'peanuts'],
  'Gluten': ['gluten', 'harina', 'trigo', 'fideos', 'pasta', 'pan', 'pan rallado', 'masa', 'avena'],
  'Lactosa': ['lactosa', 'leche', 'leche en polvo', 'queso', 'queso crema', 'crema', 'manteca', 'mantequilla', 'yogur', 'yogurt', 'ricota', 'mozzarella', 'parmesano', 'dulce de leche', 'milk', 'cheese', 'butter', 'cream'],
  'Mariscos': ['mariscos', 'camaron', 'camarones', 'langostino', 'langostinos', 'mejillon', 'mejillones', 'calamar', 'calamares'],
  'Soja': ['soja', 'soya', 'tofu', 'salsa de soja'],
  'Huevo': ['huevo', 'huevos', 'clara', 'claras', 'yema', 'yemas', 'egg', 'eggs'],
  'Frutos secos': ['frutos secos', 'almendra', 'almendras', 'nuez', 'nueces', 'avellana', 'avellanas', 'castana', 'castanas', 'pistacho', 'pistachos'],
  'Pescado': ['pescado', 'atun', 'salmon', 'merluza', 'sardina', 'sardinas'],
  'Carne': ['carne', 'pollo', 'pechuga', 'cerdo', 'jamon', 'panceta', 'tocino', 'chorizo', 'salchicha', 'vacuno', 'vacuna', 'res', 'ternera', 'cordero', 'pavo', 'beef', 'chicken', 'pork', 'bacon', 'ham'],
  'Sésamo': ['sesamo', 'tahini'],
  'Mostaza': ['mostaza', 'mustard'],
};

const RESTRICTION_TO_ALLERGENS: Record<string, string[]> = {
  'sin lactosa': ['Lactosa'],
  'libre de lactosa': ['Lactosa'],
  'intolerancia a la lactosa': ['Lactosa'],
  'sin tacc': ['Gluten'],
  'sin gluten': ['Gluten'],
  'celiaquia': ['Gluten'],
  'celiaco': ['Gluten'],
  'celiaca': ['Gluten'],
  'vegano': ['Carne', 'Pescado', 'Mariscos', 'Lactosa', 'Huevo'],
  'vegan': ['Carne', 'Pescado', 'Mariscos', 'Lactosa', 'Huevo'],
  'vegetariano': ['Carne', 'Pescado', 'Mariscos'],
  'vegetariana': ['Carne', 'Pescado', 'Mariscos'],
};

const APPLIANCE_ALIASES: Record<string, string[]> = {
  'licuadora': ['licuadora', 'blender'],
  'microondas': ['microondas', 'microwave'],
  'horno/cocina': ['horno/cocina', 'horno', 'cocina', 'hornalla', 'estufa'],
  'mixer': ['mixer', 'batidora de mano', 'minipimer'],
  'procesadora': ['procesadora', 'food processor'],
  'freidora de aire': ['freidora de aire', 'airfryer', 'air fryer'],
  'cafetera': ['cafetera'],
  'tostadora': ['tostadora'],
  'olla de presion': ['olla de presion', 'olla a presion'],
  'parrilla electrica': ['parrilla electrica', 'parrilla'],
  'batidora': ['batidora'],
};

@Component({
  selector: 'app-recipes',
  imports: [LucideAngularModule, FormsModule, RouterModule, StarRatingComponent],
  templateUrl: './recipes.html',
  styleUrl: './recipes.scss',
})
export class Recipes implements OnInit {
  private readonly recipesApi        = inject(RecipesApiService);
  private readonly router            = inject(Router);
  private readonly productService    = inject(ProductService);
  private readonly authService       = inject(AuthService);
  private readonly electrodomesticos = inject(ElectrodomesticosService);
  private readonly hogaresApi        = inject(HogaresApiService);
  private readonly perfilApi         = inject(PerfilApiService);
  private readonly destroyRef        = inject(DestroyRef);

  protected readonly icons = {
    AlarmClock,
    AlertTriangle,
    Bookmark,
    Check,
    CheckSquare,
    ChevronDown,
    ChefHat,
    Clock,
    Eye,
    Flame,
    Pencil,
    Search,
    Shield,
    ShoppingBasket,
    Shuffle,
    SlidersHorizontal,
    Star,
    X,
    Zap,
  };

  protected readonly searchQuery              = signal('');
  protected readonly activeFilter             = signal<FilterOption>('Todos');
  protected readonly sortBy                   = signal<SortOption>('urgencia');
  protected readonly showSortDropdown         = signal(false);
  protected readonly showRoulettePopup        = signal(false);
  protected readonly rouletteRecipe           = signal<RecipeWithAvailability | null>(null);
  protected readonly excludeAllergens         = signal(false);
  protected readonly excludeMissingAppliances = signal(false);
  protected readonly filterByIngredients      = signal(false);

  protected readonly filterOptions: FilterOption[] = ['Todos', 'Fácil', 'Medio', 'Difícil'];

  protected readonly householdMembers = signal<HouseholdMember[]>([]);
  protected readonly eatingToday = signal<Set<string>>(new Set());
  private readonly profileAllergies = signal<string[]>([]);

  private readonly activeAllergens = computed(() => {
    const eating = this.householdMembers().filter(member => this.eatingToday().has(member.id));
    const memberAllergens = this.expandRestrictions(eating.flatMap(member => member.allergens));
    if (memberAllergens.length > 0) {
      return memberAllergens;
    }

    const userId = this.authService.getUserId();
    const currentUserIsEating = !!userId && this.eatingToday().has(userId);
    return currentUserIsEating ? this.expandRestrictions(this.profileAllergies()) : [];
  });

  protected readonly pantryIngredients = signal<PantryIngredient[]>([]);
  private readonly allRecipes          = signal<Recipe[]>([]);
  private readonly userApplianceNames  = signal<string[]>([]);

  ngOnInit(): void {
    this.loadProfileAllergies();
    this.loadMembers();
    this.loadRecipes();
    this.loadPantry();
    this.loadAppliances();
  }

  private loadProfileAllergies(): void {
    this.perfilApi.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: profile => this.profileAllergies.set([
          ...(profile.alergias ?? []),
          ...(profile.alimentacion ?? []),
        ]),
        error: err => console.error('Error cargando alergias del perfil', err),
      });
  }

  private loadMembers(): void {
    this.hogaresApi.getMiembros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: members => {
          const mapped = members.map((member, index) => this.toHouseholdMember(member, index));
          this.householdMembers.set(mapped);
          this.eatingToday.set(new Set(mapped.map(member => member.id)));
        },
        error: err => console.error('Error cargando miembros del hogar', err),
      });
  }

  private loadRecipes(): void {
    this.recipesApi.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: recetas => this.allRecipes.set(
          recetas.map(r => this.toRecipe(r))
        ),
        error: err => console.error('Error cargando recetas', err),
      });
  }

  private loadPantry(): void {
    const hogarId = this.authService.getHogarId();
    if (!hogarId) return;
    this.productService.getProductManual()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => this.pantryIngredients.set(
          items.map(item => ({ name: item.nombre, amount: `${item.cantidad}`, selected: true }))
        ),
        error: err => console.error('Error cargando alacena', err),
      });
  }

  private loadAppliances(): void {
    this.electrodomesticos.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.userApplianceNames.set(
          items
            .flatMap(item => {
              const tipo = this.normalizeText(item.tipo ?? '');
              return tipo && tipo !== 'cocina' ? [item.nombre, item.tipo ?? ''] : [item.nombre];
            })
            .map(value => this.normalizeText(value))
            .filter(Boolean)
        );
      });
  }

  private readonly recipesWithAvailability = computed<RecipeWithAvailability[]>(() => {
    const pantry = this.pantryIngredients();
    const allergens = this.activeAllergens();

    // Nombres de los ingredientes seleccionados en el panel
    const selectedNames = pantry
      .filter(item => item.selected)
      .map(item => item.name.toLowerCase());

    const userAppliances = this.userApplianceNames();
    const hasPantryItems = pantry.length > 0;
    const hasSelected    = selectedNames.length > 0;

    return this.allRecipes().map(recipe => {
      const matched = recipe.ingredients.filter(ingredient => {
        if (hasPantryItems) {
          // Si la pantry tiene items: usar name matching con los seleccionados
          // (cubre productos agregados manualmente sin el mismo ProductoId del catálogo)
          if (!hasSelected) return false; // todo deseleccionado → 0%
          const ingName = ingredient.name.toLowerCase();
          return selectedNames.some(pName =>
            pName.includes(ingName) || ingName.includes(pName)
          );
        }
        // Pantry vacía (sin stock cargado) → usar el flag enStock del backend
        return ingredient.inStock;
      }).length;

      const availabilityPercent = recipe.ingredients.length === 0
        ? 0
        : Math.round((matched / recipe.ingredients.length) * 100);

      const hasAllergen = recipe.ingredients.some(ingredient =>
        ingredient.allergenTypes.some(ingredientAllergen =>
          allergens.some(allergen => this.normalizeText(allergen) === this.normalizeText(ingredientAllergen))
        )
      );

      const hasMissingAppliance = recipe.requiredAppliances.length > 0 &&
        recipe.requiredAppliances.some(required =>
          !this.hasCompatibleAppliance(required, userAppliances)
        );

      return { ...recipe, availabilityPercent, hasAllergen, hasMissingAppliance };
    });
  });

  protected readonly filteredRecipes = computed(() => {
    let result = [...this.recipesWithAvailability()];

    if (this.activeFilter() === 'Guardadas') {
      result = result.filter(recipe => recipe.guardada);
    } else if (this.activeFilter() !== 'Todos') {
      result = result.filter(recipe => recipe.difficulty === this.activeFilter());
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      result = result.filter(recipe => recipe.name.toLowerCase().includes(query));
    }

    if (this.excludeAllergens()) {
      result = result.filter(recipe => !recipe.hasAllergen);
    }

    if (this.excludeMissingAppliances()) {
      result = result.filter(recipe => !recipe.hasMissingAppliance);
    }

    if (this.filterByIngredients()) {
      result = result.filter(recipe => recipe.availabilityPercent > 0);
    }

    if (this.sortBy() === 'urgencia') {
      result.sort((a, b) => this.compareByUrgency(a, b));
    } else if (this.sortBy() === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (this.sortBy() === 'coincidencia') {
      result.sort((a, b) => b.availabilityPercent - a.availabilityPercent);
    } else if (this.filterByIngredients()) {
      result.sort((a, b) => b.availabilityPercent - a.availabilityPercent);
    }

    return result;
  });

  protected setFilter(filter: FilterOption): void {
    this.activeFilter.set(filter);
  }

  protected setSort(sort: SortOption): void {
    this.sortBy.set(sort);
    this.showSortDropdown.set(false);
  }

  protected toggleAllergens(): void {
    this.excludeAllergens.update(value => !value);
  }

  protected toggleMissingAppliances(): void {
    this.excludeMissingAppliances.update(value => !value);
  }

  protected toggleEatingToday(memberId: string): void {
    this.eatingToday.update(set => {
      const next = new Set(set);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  protected isEatingToday(memberId: string): boolean {
    return this.eatingToday().has(memberId);
  }

  protected toggleIngredient(index: number): void {
    this.pantryIngredients.update(items =>
      items.map((item, i) => i === index ? { ...item, selected: !item.selected } : item)
    );
  }

  protected buscarPorIngredientes(): void {
    this.filterByIngredients.set(true);
    if (this.sortBy() === 'default') {
      this.sortBy.set('coincidencia');
    }
  }

  protected limpiarFiltroPorIngredientes(): void {
    this.filterByIngredients.set(false);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected openRoulettePopup(): void {
    this.rerollRoulette();
    this.showRoulettePopup.set(true);
  }

  protected closeRoulettePopup(): void {
    this.showRoulettePopup.set(false);
  }

  protected rerollRoulette(): void {
    const currentId = this.rouletteRecipe()?.id;
    const candidates = this.recipesWithAvailability()
      .filter(recipe => recipe.availabilityPercent > 50 && !recipe.hasAllergen);
    const pool = candidates.length > 1
      ? candidates.filter(recipe => recipe.id !== currentId)
      : candidates;
    this.rouletteRecipe.set(pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null);
  }

  protected missingIngredientNames(recipe: RecipeWithAvailability): string[] {
    return recipe.ingredients
      .filter(ingredient => !ingredient.inStock)
      .map(ingredient => ingredient.name);
  }

  protected get selectedIngredients(): PantryIngredient[] {
    return this.pantryIngredients().filter(item => item.selected);
  }

  protected getAvailabilityColor(percent: number): string {
    if (percent >= 75) return '#3E5E4A';
    if (percent >= 50) return '#B48B6A';
    return '#b44c3c';
  }

  protected getSortLabel(): string {
    if (this.sortBy() === 'urgencia') return 'Mayor urgencia';
    if (this.sortBy() === 'rating') return 'Mejor valoradas';
    if (this.sortBy() === 'coincidencia') return 'Mayor coincidencia';
    return 'Ordenar';
  }

  protected difficultyBadgeClass(difficulty: Difficulty): string {
    const base = 'absolute bottom-2 right-2 px-2.5 py-0.5 rounded-[20px] text-[0.7rem] font-semibold';
    if (difficulty === 'Fácil') return `${base} bg-[rgba(62,94,74,0.9)] text-nido-cream`;
    if (difficulty === 'Medio') return `${base} bg-nido-gold/90 text-white`;
    return `${base} bg-[rgba(180,70,60,0.9)] text-white`;
  }

  protected filterChipClass(filter: FilterOption): string {
    const base = 'px-4 py-[0.4rem] rounded-[20px] border-[1.5px] border-solid font-medium text-[0.8125rem] cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5';
    return this.activeFilter() === filter
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-white border-nido-border text-nido-brown hover:border-nido-green hover:text-nido-green`;
  }

  protected allergenChipClass(): string {
    const base = 'px-4 py-[0.4rem] rounded-[20px] border-[1.5px] border-solid font-medium text-[0.8125rem] cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5';
    return this.excludeAllergens()
      ? `${base} bg-nido-red border-nido-red text-white`
      : `${base} bg-white border-nido-border text-nido-brown hover:border-nido-green hover:text-nido-green`;
  }

  protected applianceChipClass(): string {
    const base = 'px-4 py-[0.4rem] rounded-[20px] border-[1.5px] border-solid font-medium text-[0.8125rem] cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5';
    return this.excludeMissingAppliances()
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-white border-nido-border text-nido-brown hover:border-nido-green hover:text-nido-green`;
  }

  protected ingredientChipClass(selected: boolean): string {
    const base = 'flex items-center gap-1.5 px-3 py-[0.3rem] rounded-[20px] border-[1.5px] border-solid text-[0.775rem] cursor-pointer transition-all duration-150';
    return selected
      ? `${base} bg-nido-green-dark border-nido-green-dark text-nido-cream`
      : `${base} bg-nido-cream border-nido-border text-nido-brown`;
  }

  protected sortOptionClass(option: SortOption): string {
    const base = 'w-full px-4 py-2.5 text-left border-0 bg-transparent text-[0.8375rem] cursor-pointer block hover:bg-nido-cream';
    return this.sortBy() === option
      ? `${base} text-nido-gold font-semibold`
      : `${base} text-nido-green-dark`;
  }

  protected memberToggleClass(memberId: string): string {
    const base = 'flex min-w-0 min-h-11 items-center gap-2 px-2.5 py-2 rounded-[10px] border-[1.5px] border-solid cursor-pointer transition-all duration-150 relative w-full';
    return this.isEatingToday(memberId)
      ? `${base} bg-white`
      : `${base} bg-nido-cream border-nido-border`;
  }

  // ── Métodos de la compañera — sin modificar ───────────────
  private toRecipe(receta: ApiReceta): Recipe {
    return {
      id: receta.id,
      name: receta.nombre,
      image: this.resolveImageUrl(receta.imagenUrl) ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop',
      rating: receta.calificacionPromedio ?? 0,
      ratingCount: receta.calificacionTotal ?? 0,
      difficulty: this.mapDifficulty(receta.dificultad),
      timeMinutes: receta.tiempoCoccionMin ?? 0,
      calories: Math.round(receta.calorias ?? 0),
      vecesCocinada: receta.vecesCocinada ?? 0,
      tieneProductosPorVencer: receta.tieneProductosPorVencer ?? false,
      fechaVencimientoMasProxima: receta.fechaVencimientoMasProxima ?? null,
      diasHastaVencimiento: receta.diasHastaVencimiento ?? null,
      productosPorVencer: (receta.productosPorVencer ?? []).map(producto => ({
        productId: producto.productoId,
        name: producto.nombre,
        expirationDate: producto.fechaVencimiento,
        daysUntilExpiration: producto.diasHastaVencimiento,
      })),
      guardada: receta.guardada ?? false,
      ingredients: receta.ingredientes.map(ingrediente => {
        const ingredientName = ingrediente.productoNombre || ingrediente.nombre;
        return {
          name: ingredientName,
          inStock: ingrediente.enStock,
          allergenTypes: this.mergeAllergens([
            ...(ingrediente.alergenos ?? []),
            ...this.detectIngredientAllergens(ingredientName),
          ]),
        };
      }),
      requiredAppliances: (receta.electrodomesticos ?? [])
        .map(electrodomestico => electrodomestico.tipoRequerido?.trim())
        .filter((tipo): tipo is string => !!tipo),
    };
  }

  private compareByUrgency(a: RecipeWithAvailability, b: RecipeWithAvailability): number {
    const urgencyDiff = Number(b.tieneProductosPorVencer) - Number(a.tieneProductosPorVencer);
    if (urgencyDiff !== 0) return urgencyDiff;

    const aDays = a.diasHastaVencimiento ?? Number.POSITIVE_INFINITY;
    const bDays = b.diasHastaVencimiento ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;

    if (a.availabilityPercent !== b.availabilityPercent) {
      return b.availabilityPercent - a.availabilityPercent;
    }

    return a.name.localeCompare(b.name, 'es');
  }

  protected formatExpiringProductDays(days: number): string {
    if (days <= 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    return `Vence en ${days} días`;
  }

  protected getUrgencyFallbackText(recipe: Recipe): string {
    if (recipe.diasHastaVencimiento === null) {
      return 'Producto próximo a vencer';
    }

    return this.formatExpiringProductDays(recipe.diasHastaVencimiento);
  }

  private toHouseholdMember(member: MiembroResponse, index: number): HouseholdMember {
    return {
      id: member.usuarioId,
      name: member.nombre,
      initials: this.getInitials(member.nombre),
      color: MEMBER_COLORS[index % MEMBER_COLORS.length],
      allergens: this.expandRestrictions(member.alergias ?? []),
    };
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '--';
    return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  private hasCompatibleAppliance(required: string, ownedAppliances: string[]): boolean {
    const normalizedRequired = this.normalizeText(required);
    const aliases = APPLIANCE_ALIASES[normalizedRequired] ?? [normalizedRequired];

    return aliases.some(alias => {
      const normalizedAlias = this.normalizeText(alias);
      return ownedAppliances.some(owned =>
        owned.includes(normalizedAlias) || normalizedAlias.includes(owned)
      );
    });
  }

  private detectIngredientAllergens(ingredientName: string): string[] {
    const normalizedIngredient = this.normalizeText(ingredientName);
    return Object.entries(ALLERGEN_ALIASES)
      .filter(([, aliases]) => aliases.some(alias => normalizedIngredient.includes(this.normalizeText(alias))))
      .map(([allergen]) => allergen);
  }

  private mergeAllergens(allergens: string[]): string[] {
    const byNormalized = new Map<string, string>();
    for (const allergen of allergens) {
      const normalized = this.normalizeText(allergen);
      if (normalized && !byNormalized.has(normalized)) {
        byNormalized.set(normalized, allergen);
      }
    }

    return [...byNormalized.values()];
  }

  private expandRestrictions(restrictions: string[]): string[] {
    const expanded = restrictions.flatMap(restriction => {
      const normalized = this.normalizeText(restriction);
      return RESTRICTION_TO_ALLERGENS[normalized] ?? [restriction];
    });

    return [...new Set(expanded)];
  }

  private normalizeText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private mapDifficulty(value: string | null): Difficulty {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'facil' || normalized === 'fácil') return 'Fácil';
    if (normalized === 'dificil' || normalized === 'difícil') return 'Difícil';
    return 'Medio';
  }

  protected navigateToRecipe(id: string): void {
    this.router.navigate(['/recetas', id]);
  }

  private resolveImageUrl(url: string | null): string | null {
    if (!url) {
      return null;
    }

    if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) {
      return url;
    }

    const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseUrl}${path}`;
  }
}
