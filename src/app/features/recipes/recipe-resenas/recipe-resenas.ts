import { Component, Input, ChangeDetectionStrategy, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RecipesApiService, ApiResena } from '../recipes/services/recipes-api.service';
import { StarRatingComponent } from '../../../shared/ui/star-rating/star-rating';

/**
 * Sección de reseñas para una receta:
 *  - Promedio + total visible arriba
 *  - "Mi calificación" editable (estrellas + comentario opcional)
 *  - Lista de reseñas de otros usuarios
 *
 * El usuario solo puede tener 1 reseña por receta (upsert).
 */
@Component({
  selector: 'app-recipe-resenas',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, StarRatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-resenas.html',
})
export class RecipeResenasComponent implements OnChanges {
  /** Id de la receta a calificar. */
  @Input({ required: true }) recetaId!: string;

  private readonly api = inject(RecipesApiService);

  protected readonly loading       = signal(true);
  protected readonly saving        = signal(false);
  protected readonly errorMessage  = signal<string | null>(null);
  protected readonly otras         = signal<ApiResena[]>([]);
  protected readonly miResena      = signal<ApiResena | null>(null);
  protected readonly promedio      = signal(0);
  protected readonly total         = signal(0);

  protected readonly puntuacionInput = signal(0);
  protected readonly comentarioInput = signal('');
  protected readonly modoEdicion     = signal(false);

  protected readonly tieneMia = computed(() => !!this.miResena());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recetaId'] && this.recetaId) this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.getResenas(this.recetaId).subscribe({
      next: res => {
        this.miResena.set(res.miResena);
        this.otras.set(res.items.filter(r => r.id !== res.miResena?.id));
        this.promedio.set(res.promedio);
        this.total.set(res.total);
        this.puntuacionInput.set(res.miResena?.puntuacion ?? 0);
        this.comentarioInput.set(res.miResena?.comentario ?? '');
        this.modoEdicion.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las reseñas.');
        this.loading.set(false);
      },
    });
  }

  protected startEdit(): void {
    this.puntuacionInput.set(this.miResena()?.puntuacion ?? 0);
    this.comentarioInput.set(this.miResena()?.comentario ?? '');
    this.modoEdicion.set(true);
    this.errorMessage.set(null);
  }

  protected cancelEdit(): void {
    this.modoEdicion.set(false);
    this.errorMessage.set(null);
  }

  protected guardar(): void {
    const puntuacion = this.puntuacionInput();
    if (puntuacion < 1 || puntuacion > 5) {
      this.errorMessage.set('Tenés que elegir entre 1 y 5 estrellas.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const comentario = this.comentarioInput().trim() || null;

    this.api.upsertResena(this.recetaId, puntuacion, comentario).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.errorMessage.set('No se pudo guardar tu reseña.');
        this.saving.set(false);
      },
    });
  }

  protected eliminar(): void {
    if (!this.miResena()) return;
    if (!confirm('¿Eliminar tu reseña?')) return;

    this.saving.set(true);
    this.api.deleteResena(this.recetaId).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.errorMessage.set('No se pudo eliminar tu reseña.');
        this.saving.set(false);
      },
    });
  }
}
