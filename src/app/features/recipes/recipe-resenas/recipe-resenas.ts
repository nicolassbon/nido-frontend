import { Component, Input, ChangeDetectionStrategy, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RecipesApiService, ApiResena, ApiNota } from '../recipes/services/recipes-api.service';
import { StarRatingComponent } from '../../../shared/ui/star-rating/star-rating';
import { Avatar } from '../../../shared/ui/avatar/avatar';

@Component({
  selector: 'app-recipe-resenas',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, StarRatingComponent, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-resenas.html',
})
export class RecipeResenasComponent implements OnChanges {
  @Input({ required: true }) recetaId!: string;

  private readonly api = inject(RecipesApiService);

  // ── Rating ──────────────────────────────────────────────
  protected readonly loadingRating   = signal(true);
  protected readonly savingRating    = signal(false);
  protected readonly errorRating     = signal<string | null>(null);
  protected readonly miResena        = signal<ApiResena | null>(null);
  protected readonly otrasResenas    = signal<ApiResena[]>([]);
  protected readonly promedio        = signal(0);
  protected readonly total           = signal(0);
  protected readonly modoEdicion     = signal(false);
  protected readonly puntuacionInput = signal(0);
  protected readonly tieneMia        = computed(() => !!this.miResena());

  // ── Notas ───────────────────────────────────────────────
  protected readonly loadingNotas  = signal(true);
  protected readonly savingNota    = signal(false);
  protected readonly errorNota     = signal<string | null>(null);
  protected readonly notas         = signal<ApiNota[]>([]);
  protected readonly textoInput    = signal('');
  protected readonly currentUserId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recetaId'] && this.recetaId) {
      this.loadRating();
      this.loadNotas();
    }
  }

  // ── Carga ───────────────────────────────────────────────
  protected loadRating(): void {
    this.loadingRating.set(true);
    this.errorRating.set(null);
    this.api.getResenas(this.recetaId).subscribe({
      next: res => {
        this.miResena.set(res.miResena);
        this.otrasResenas.set(res.items.filter(r => r.id !== res.miResena?.id));
        this.promedio.set(res.promedio);
        this.total.set(res.total);
        this.puntuacionInput.set(res.miResena?.puntuacion ?? 0);
        if (res.miResena) this.currentUserId.set(res.miResena.usuarioId);
        this.modoEdicion.set(false);
        this.loadingRating.set(false);
      },
      error: () => {
        this.errorRating.set('No se pudo cargar la calificación.');
        this.loadingRating.set(false);
      },
    });
  }

  protected loadNotas(): void {
    this.loadingNotas.set(true);
    this.api.getNotas(this.recetaId).subscribe({
      next: res => {
        this.notas.set(res.items);
        if (res.items.length > 0 && !this.currentUserId()) {
          // usamos el primer usuario propio que encontremos (no hay endpoint de "quién soy")
        }
        this.loadingNotas.set(false);
      },
      error: () => this.loadingNotas.set(false),
    });
  }

  // ── Rating actions ──────────────────────────────────────
  protected startEdit(): void {
    this.puntuacionInput.set(this.miResena()?.puntuacion ?? 0);
    this.modoEdicion.set(true);
    this.errorRating.set(null);
  }

  protected cancelEdit(): void {
    this.modoEdicion.set(false);
    this.errorRating.set(null);
  }

  protected guardarRating(): void {
    const p = this.puntuacionInput();
    if (p < 1 || p > 5) {
      this.errorRating.set('Elegí entre 1 y 5 estrellas.');
      return;
    }
    this.savingRating.set(true);
    this.errorRating.set(null);
    this.api.upsertResena(this.recetaId, p, null).subscribe({
      next: () => { this.savingRating.set(false); this.loadRating(); },
      error: () => { this.errorRating.set('No se pudo guardar.'); this.savingRating.set(false); },
    });
  }

  protected eliminarRating(): void {
    if (!confirm('¿Eliminar tu calificación?')) return;
    this.savingRating.set(true);
    this.api.deleteResena(this.recetaId).subscribe({
      next: () => { this.savingRating.set(false); this.loadRating(); },
      error: () => { this.errorRating.set('No se pudo eliminar.'); this.savingRating.set(false); },
    });
  }

  // ── Nota actions ────────────────────────────────────────
  protected agregarNota(): void {
    const texto = this.textoInput().trim();
    if (!texto) return;
    this.savingNota.set(true);
    this.errorNota.set(null);
    this.api.addNota(this.recetaId, texto).subscribe({
      next: nota => {
        this.notas.update(list => [nota, ...list]);
        this.textoInput.set('');
        this.savingNota.set(false);
        if (!this.currentUserId()) this.currentUserId.set(nota.usuarioId);
      },
      error: () => { this.errorNota.set('No se pudo guardar la nota.'); this.savingNota.set(false); },
    });
  }

  protected eliminarNota(notaId: string): void {
    this.api.deleteNota(this.recetaId, notaId).subscribe({
      next: () => this.notas.update(list => list.filter(n => n.id !== notaId)),
    });
  }

  protected esMia(nota: ApiNota): boolean {
    const uid = this.currentUserId();
    return !!uid && nota.usuarioId === uid;
  }

  protected formatDate(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
