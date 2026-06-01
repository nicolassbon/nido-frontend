import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { ApiReceta, RecipesApiService } from '../recipes/services/recipes-api.service';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.scss',
})
export class RecipeDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly recipesService = inject(RecipesApiService);
  protected readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recipe = signal<ApiReceta | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly imageFailed = signal(false);
  protected readonly imageUrl = computed(() => this.resolveImageUrl(this.recipe()?.imagenUrl ?? null));
  protected readonly availableIngredients = computed(() =>
    this.recipe()?.ingredientes.filter(ingrediente => ingrediente.enStock).length ?? 0
  );

  constructor() {
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
          this.loading.set(false);
        },
        error: error => {
          console.error('Error cargando detalle de receta:', error);
          this.errorMessage.set('No se pudo cargar la receta. Por favor, intenta mas tarde.');
          this.loading.set(false);
        },
      });
  }

  protected goBack(): void {
    this.router.navigate(['/recetas']);
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  protected formatAmount(value: number | null | undefined, unit: string | null | undefined): string {
    const suffix = unit ? ` ${unit}` : '';

    if (value === null || value === undefined) {
      return suffix.trim() || '-';
    }

    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
  }

  protected formatNutrition(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
  }

  protected displayDifficulty(value: string | null | undefined): string {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'facil') return 'Facil';
    if (normalized === 'dificil') return 'Dificil';

    return value?.trim() || '-';
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
