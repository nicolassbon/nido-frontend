import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Bookmark, BookmarkCheck, LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { ApiReceta, ApiRecetaIngrediente, RecipesApiService } from '../recipes/services/recipes-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductService } from '../../../core/servicios/agregar-producto.service';
import { ListaComprasService } from '../../lista-compras/lista-compras.service';
import { Electrodomestico, ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';
import { RecipeResenasComponent } from '../recipe-resenas/recipe-resenas';

const SOURCE_LABELS: Record<string, string> = {
  spoonacular: 'Spoonacular',
  manual: 'Nido',
  nido: 'Nido',
};

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, RecipeResenasComponent],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.scss',
})
export class RecipeDetail {
  private readonly route          = inject(ActivatedRoute);
  private readonly recipesService = inject(RecipesApiService);
  private readonly authService    = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly listaService   = inject(ListaComprasService);
  private readonly electrodomesticosService = inject(ElectrodomesticosService);
  protected readonly router       = inject(Router);
  private readonly destroyRef     = inject(DestroyRef);
  protected readonly bookmarkIcon = Bookmark;
  protected readonly bookmarkCheckIcon = BookmarkCheck;

  protected readonly recipe           = signal<ApiReceta | null>(null);
  protected readonly loading          = signal(false);
  protected readonly errorMessage     = signal<string | null>(null);
  protected readonly imageFailed      = signal(false);
  protected readonly savingRecipe     = signal(false);

  // Modal de confirmación para cocinar
  protected readonly showCookModal    = signal(false);
  protected readonly cookingState     = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly vecesCocinada    = signal<number>(0);

  // Nombres de la alacena del usuario (para name-matching como fallback)
  private readonly pantryNames    = signal<string[]>([]);
  private readonly householdAppliances = signal<Electrodomestico[]>([]);

  protected readonly imageUrl = computed(() =>
    this.resolveImageUrl(this.recipe()?.imagenUrl ?? null)
  );

  // Un ingrediente está disponible si:
  //   1. enStock (match exacto por ProductoId en el backend), O
  //   2. La alacena tiene un item cuyo nombre coincide (fallback para productos manuales)
  protected readonly isDisponible = computed(() => {
    const names = this.pantryNames();
    return (ingrediente: ApiRecetaIngrediente): boolean => {
      if (ingrediente.enStock) return true;
      if (names.length === 0)  return false;
      const ingName = (ingrediente.productoNombre || ingrediente.nombre).toLowerCase();
      return names.some(n => n.includes(ingName) || ingName.includes(n));
    };
  });

  protected readonly availableIngredients = computed(() =>
    (this.recipe()?.ingredientes ?? []).filter(i => this.isDisponible()(i)).length
  );

  protected readonly missingIngredients = computed(() =>
    (this.recipe()?.ingredientes ?? []).filter(i => !this.isDisponible()(i))
  );

  protected readonly requiredAppliances = computed(() =>
    (this.recipe()?.electrodomesticos ?? [])
      .filter(item => !!item.tipoRequerido?.trim())
      .map(item => ({
        ...item,
        label: this.formatApplianceName(item.tipoRequerido),
        available: this.hasAppliance(item.tipoRequerido),
        icon: this.getApplianceIcon(item.tipoRequerido),
      }))
  );

  constructor() {
    // Cargar pantry para el name-matching
    const hogarId = this.authService.getHogarId();
    if (hogarId) {
      this.productService.getProductManual().subscribe({
        next: items => {
          this.pantryNames.set(items.map(i => i.nombre.toLowerCase()));
        },
      });

      this.electrodomesticosService.getAll()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: items => this.householdAppliances.set(items),
        });
    }

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (!id) {
          this.errorMessage.set('ID de receta no proporcionado');
          this.loading.set(false);
          return;
        }
        this.loadRecipe(id);
      });
  }

  private loadRecipe(id: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.imageFailed.set(false);

    this.recipesService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: receta => {
          this.recipe.set(receta);
          this.vecesCocinada.set(receta.vecesCocinada ?? 0);
          this.loading.set(false);
        },
        error: error => {
          console.error('Error cargando detalle de receta:', error);
          this.errorMessage.set('No se pudo cargar la receta. Por favor, intenta mas tarde.');
          this.loading.set(false);
        },
      });
  }

  protected abrirModalCocinar(): void {
    this.cookingState.set('idle');
    this.showCookModal.set(true);
  }

  protected cerrarModalCocinar(): void {
    if (this.cookingState() === 'loading') return;
    this.showCookModal.set(false);
    this.cookingState.set('idle');
  }

  protected confirmarCocinar(): void {
    const receta = this.recipe();
    if (!receta || this.cookingState() === 'loading') return;

    this.cookingState.set('loading');

    this.recipesService
      .cocinar(receta.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.vecesCocinada.set(res.vecesCocinada);
          this.cookingState.set('success');
        },
        error: () => {
          this.cookingState.set('error');
        },
      });
  }

  protected toggleSaved(): void {
    const receta = this.recipe();
    if (!receta || this.savingRecipe()) return;

    this.savingRecipe.set(true);
    const request = receta.guardada
      ? this.recipesService.unsave(receta.id)
      : this.recipesService.save(receta.id);

    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.recipe.set({ ...receta, guardada: !receta.guardada });
          this.savingRecipe.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo actualizar la receta guardada.');
          this.savingRecipe.set(false);
        },
      });
  }

  protected agregarFaltantesALista(): void {
    const receta    = this.recipe();
    const faltantes = this.missingIngredients();
    if (!receta || faltantes.length === 0) return;

    const items = faltantes.map(i => ({
      nombre:   i.productoNombre || i.nombre,
      cantidad: i.cantidadListaCompras ?? i.cantidad,
      unidad:   i.unidadListaCompras ?? i.unidad,
    }));
    const items = faltantes.map(i => {
      const targetUnit = i.unidadCompraEstandar ?? i.unidad;
      const isCooking = isCookingUnit(targetUnit);
      
      let cantidad = isCooking ? null : (i.cantidadCompraEstandar ?? i.cantidad);
      let unidad = isCooking ? null : targetUnit;

      if (!unidad && cantidad !== null && cantidad !== undefined && cantidad % 1 !== 0) {
        cantidad = null;
      }

      return {
        nombre:   i.productoNombre || cleanIngredientName(i.nombre),
        cantidad,
        unidad,
      };
    });

    this.listaService.addGroupToLista(receta.nombre, items).subscribe({
      next: () => {
        this.router.navigate(['/lista-compras']);
      },
      error: () => {
        this.errorMessage.set('No se pudo agregar los faltantes a la lista de compras.');
      },
    });

    // Pasar también por router state para garantizar el primer render
  }

  protected goBack(): void {
    this.router.navigate(['/recetas']);
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  protected formatAmount(value: number | null | undefined, unit: string | null | undefined): string {
    const suffix = unit ? ` ${unit}` : '';
    if (value === null || value === undefined) return suffix.trim() || '-';
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
  }

  protected formatNutrition(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
  }

  protected displayDifficulty(value: string | null | undefined): string {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'facil')   return 'Facil';
    if (normalized === 'dificil') return 'Dificil';
    return value?.trim() || '-';
  }

  protected nutritionSourceLabel(fuenteId: string | null | undefined): string | null {
    const sourceKey = fuenteId?.trim().split('-')[0]?.toLowerCase();
    if (!sourceKey) return null;

    return SOURCE_LABELS[sourceKey] ?? this.toTitleCase(sourceKey);
  }

  protected formatApplianceName(value: string | null | undefined): string {
    const clean = value?.trim();
    if (!clean) return 'Electrodomestico';

    return clean
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private hasAppliance(required: string | null | undefined): boolean {
    const normalizedRequired = this.normalizeText(required);
    if (!normalizedRequired) return false;

    return this.householdAppliances().some(item => {
      const type = this.normalizeText(item.tipo);
      const name = this.normalizeText(item.nombre);
      return (type.length > 0 && (type.includes(normalizedRequired) || normalizedRequired.includes(type)))
        || (name.length > 0 && (name.includes(normalizedRequired) || normalizedRequired.includes(name)));
    });
  }

  private getApplianceIcon(value: string | null | undefined): string {
    const normalized = this.normalizeText(value);
    if (normalized.includes('horno')) return 'cooking-pot';
    if (normalized.includes('micro')) return 'microwave';
    if (normalized.includes('licuadora')) return 'blend';
    if (normalized.includes('batidora')) return 'cog';
    if (normalized.includes('heladera')) return 'refrigerator';
    if (normalized.includes('freezer')) return 'snowflake';
    return 'plug';
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private toTitleCase(value: string): string {
    return value
      .replace(/[_\s]+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private resolveImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url;
    const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const path    = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }
}

const COOKING_UNITS = new Set([
  'taza', 'tazas', 'cup', 'cups',
  'cda', 'cdas', 'cucharada', 'cucharadas', 'tbsp', 'tablespoon', 'tablespoons',
  'cdta', 'cdtas', 'cucharadita', 'cucharaditas', 'tsp', 'teaspoon', 'teaspoons',
  'pizca', 'pizcas', 'pinch', 'pinches',
  'chorrito', 'chorritos', 'splash',
  'al gusto', 'c/n', 'gota', 'gotas'
]);

export function isCookingUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  return COOKING_UNITS.has(unit.trim().toLowerCase().replace(/\./g, ''));
}

const PREP_KEYWORDS = [
  'cortado', 'picado', 'rallado', 'troceado', 'fileteado',
  'en trozos', 'en cubos', 'finamente', 'groseramente', 'bien',
  'pelado', 'cocido', 'cocido al vapor', 'desmenuzado', 'picada',
  'para decorar', 'decorar', 'para servir', 'al gusto', 'a gusto',
  'opcional', ' molido', ' molida', ' picada', ' picado',
  ' fresco', ' fresca', ' frescos', ' frescas', ' seco', ' seca'
];

export function cleanIngredientName(name: string): string {
  const lower = name.toLowerCase();
  let minIdx = -1;
  for (const keyword of PREP_KEYWORDS) {
    const idx = lower.indexOf(keyword);
    if (idx > 0 && (minIdx === -1 || idx < minIdx)) {
      minIdx = idx;
    }
  }
  if (minIdx > 0) {
    return name.slice(0, minIdx).trim().replace(/[,.:]$/, '').trim();
  }
  return name.trim();
}

