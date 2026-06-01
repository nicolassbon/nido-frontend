import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { ApiReceta, RecipesApiService } from './services/recipes-api.service';
import { ProductService } from '../../../core/servicios/agregar-producto.service';
import { AuthService } from '../../../core/auth/auth.service';

type Difficulty = 'Fácil' | 'Medio' | 'Difícil';
type FilterOption = 'Todos' | Difficulty;
type SortOption = 'default' | 'rating' | 'coincidencia';

interface RecipeIngredient {
  name: string;
  inStock: boolean;
  allergenType?: string;
}

interface Recipe {
  id: string;
  name: string;
  image: string;
  rating: number;
  difficulty: Difficulty;
  timeMinutes: number;
  calories: number;
  ingredients: RecipeIngredient[];
  vecesCocinada: number;
}

interface RecipeWithAvailability extends Recipe {
  availabilityPercent: number;
  hasAllergen: boolean;
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

@Component({
  selector: 'app-recipes',
  imports: [LucideAngularModule, FormsModule, RouterModule],
  templateUrl: './recipes.html',
  styleUrl: './recipes.scss',
})
export class Recipes implements OnInit {
  private readonly recipesApi = inject(RecipesApiService);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly authService = inject(AuthService);

  protected readonly searchQuery = signal('');
  protected readonly activeFilter = signal<FilterOption>('Todos');
  protected readonly sortBy = signal<SortOption>('default');
  protected readonly showSortDropdown = signal(false);
  protected readonly excludeAllergens = signal(false);
  protected readonly filterByIngredients = signal(false);

  protected readonly filterOptions: FilterOption[] = ['Todos', 'Fácil', 'Medio', 'Difícil'];

  protected readonly householdMembers: HouseholdMember[] = [
    { id: 'm1', name: 'Luisa', initials: 'LU', color: '#3E5E4A', allergens: [] },
    { id: 'm2', name: 'Marco', initials: 'MA', color: '#B48B6A', allergens: ['Gluten'] },
    { id: 'm3', name: 'Sofia', initials: 'SO', color: '#927357', allergens: ['Mariscos'] },
    { id: 'm4', name: 'Juan', initials: 'JU', color: '#263F30', allergens: [] },
  ];

  protected readonly eatingToday = signal<Set<string>>(
    new Set(this.householdMembers.map(member => member.id))
  );

  private readonly activeAllergens = computed(() => {
    const eating = this.householdMembers.filter(member => this.eatingToday().has(member.id));
    return [...new Set(eating.flatMap(member => member.allergens))];
  });

  protected readonly pantryIngredients = signal<PantryIngredient[]>([]);

  private readonly allRecipes = signal<Recipe[]>([]);

  ngOnInit(): void {
    this.recipesApi.getAll().subscribe({
      next: recetas => {
        this.allRecipes.set(recetas.map(receta => this.toRecipe(receta)));
      },
      error: error => {
        console.error('Error cargando recetas', error);
      },
    });

    const hogarId = this.authService.getHogarId();
    if (hogarId) {
      this.productService.getProductManual().subscribe({
        next: items => {
          this.pantryIngredients.set(
            items.map(item => ({
              name: item.nombre,
              amount: `${item.cantidad}`,
              selected: true,
            }))
          );
        },
        error: error => {
          console.error('Error cargando alacena', error);
        },
      });
    }
  }

  private readonly recipesWithAvailability = computed<RecipeWithAvailability[]>(() => {
    const pantry = this.pantryIngredients();
    const allergens = this.activeAllergens();

    // Nombres de los ingredientes seleccionados en el panel
    const selectedNames = pantry
      .filter(item => item.selected)
      .map(item => item.name.toLowerCase());

    const hasPantryItems = pantry.length > 0;
    const hasSelected = selectedNames.length > 0;

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
        ingredient.allergenType &&
        allergens.some(allergen =>
          allergen.toLowerCase() === ingredient.allergenType!.toLowerCase()
        )
      );

      return { ...recipe, availabilityPercent, hasAllergen };
    });
  });

  protected readonly filteredRecipes = computed(() => {
    let result = [...this.recipesWithAvailability()];

    if (this.activeFilter() !== 'Todos') {
      result = result.filter(recipe => recipe.difficulty === this.activeFilter());
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      result = result.filter(recipe => recipe.name.toLowerCase().includes(query));
    }

    if (this.excludeAllergens()) {
      result = result.filter(recipe => !recipe.hasAllergen);
    }

    if (this.filterByIngredients()) {
      result = result.filter(recipe => recipe.availabilityPercent > 0);
    }

    if (this.sortBy() === 'rating') {
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

  protected get selectedIngredients(): PantryIngredient[] {
    return this.pantryIngredients().filter(item => item.selected);
  }

  protected getAvailabilityColor(percent: number): string {
    if (percent >= 75) return '#3E5E4A';
    if (percent >= 50) return '#B48B6A';
    return '#b44c3c';
  }

  protected getSortLabel(): string {
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
    const base = 'flex items-center gap-2 px-2.5 py-2 rounded-[10px] border-[1.5px] border-solid cursor-pointer transition-all duration-150 relative w-full';
    return this.isEatingToday(memberId)
      ? `${base} bg-white`
      : `${base} bg-nido-cream border-nido-border`;
  }

  private toRecipe(receta: ApiReceta): Recipe {
    return {
      id: receta.id,
      name: receta.nombre,
      image: this.resolveImageUrl(receta.imagenUrl) ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop',
      rating: 4.5,
      difficulty: this.mapDifficulty(receta.dificultad),
      timeMinutes: receta.tiempoCoccionMin ?? 0,
      calories: Math.round(receta.calorias ?? 0),
      vecesCocinada: receta.vecesCocinada ?? 0,
      ingredients: receta.ingredientes.map(ingrediente => ({
        name: ingrediente.productoNombre || ingrediente.nombre,
        inStock: ingrediente.enStock,
      })),
    };
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

    const baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseUrl}${path}`;
  }
}
