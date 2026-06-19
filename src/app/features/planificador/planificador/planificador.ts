import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiReceta, RecipesApiService } from '../../recipes/recipes/services/recipes-api.service';
import {
  AddItemRequest,
  PlanificadorItemDto,
  PlanificadorSemanaDto,
  PlanificadorService,
  UpdateItemRequest,
} from '../planificador.service';

type TipoComida = 'desayuno' | 'almuerzo' | 'cena' | 'tarea';

interface SlotModal {
  fecha: string;
  tipoComida: TipoComida;
  tituloLibre: string;
  recetaId: string;
  hora: string;
}

@Component({
  selector: 'app-planificador',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './planificador.html',
  styleUrl: './planificador.scss',
})
export class Planificador implements OnInit, OnDestroy {
  private readonly svc = inject(PlanificadorService);
  private readonly recetasSvc = inject(RecipesApiService);
  private readonly destroy$ = new Subject<void>();

  protected readonly isLoading = signal(true);
  protected readonly isLoadingRecipes = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly semana = signal<PlanificadorSemanaDto | null>(null);
  protected readonly lunes = signal<Date>(PlanificadorService.getLunes(new Date()));
  protected readonly recetas = signal<ApiReceta[]>([]);
  protected readonly recipeQuery = signal('');

  protected readonly showModal = signal(false);
  protected readonly modalSlot = signal<SlotModal | null>(null);
  protected readonly editingItem = signal<PlanificadorItemDto | null>(null);
  protected readonly openMenuItemId = signal<string | null>(null);

  protected readonly TIPOS: TipoComida[] = ['desayuno', 'almuerzo', 'cena', 'tarea'];
  protected readonly TIPO_LABELS: Record<TipoComida, string> = {
    desayuno: 'Desayuno',
    almuerzo: 'Almuerzo',
    cena: 'Cena',
    tarea: 'Tareas del hogar',
  };
  protected readonly TIPO_ICONS: Record<TipoComida, string> = {
    desayuno: 'coffee',
    almuerzo: 'sun',
    cena: 'moon',
    tarea: 'house',
  };
  protected readonly DEFAULT_HOURS: Record<TipoComida, string> = {
    desayuno: '08:00',
    almuerzo: '13:00',
    cena: '20:00',
    tarea: '',
  };
  protected readonly weekDays = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

  protected readonly dias = computed(() => {
    const l = this.lunes();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(l);
      d.setDate(l.getDate() + i);
      const isoDate = PlanificadorService.toIso(d);

      return {
        isoDate,
        dayName: this.weekDays[i],
        dayLabel: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        esHoy: isoDate === PlanificadorService.toIso(new Date()),
      };
    });
  });

  protected readonly itemsMap = computed(() => {
    const s = this.semana();
    const map = new Map<string, PlanificadorItemDto[]>();
    if (!s) return map;

    for (const item of s.items) {
      const key = `${item.fecha}|${item.tipoComida}`;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }

    return map;
  });

  protected readonly recetasFiltradas = computed(() => {
    const query = this.normalize(this.recipeQuery());
    const recetas = this.recetas();
    if (!query) return recetas.slice(0, 24);

    return recetas
      .filter(receta => this.normalize(receta.nombre).includes(query))
      .slice(0, 24);
  });

  protected readonly selectedRecipe = computed(() => {
    const id = this.modalSlot()?.recetaId;
    if (!id) return null;
    return this.recetas().find(receta => receta.id === id) ?? null;
  });

  protected readonly rangoSemana = computed(() => {
    const dias = this.dias();
    if (!dias.length) return '';
    const first = new Date(dias[0].isoDate + 'T12:00:00');
    const last = new Date(dias[6].isoDate + 'T12:00:00');
    const fmtDay = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    return `${fmtDay(first)} - ${fmtDay(last)}`;
  });

  ngOnInit(): void {
    this.loadSemana();
    this.loadRecetas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected getItems(fecha: string, tipo: TipoComida): PlanificadorItemDto[] {
    return this.itemsMap().get(`${fecha}|${tipo}`) ?? [];
  }

  protected prevSemana(): void {
    const d = new Date(this.lunes());
    d.setDate(d.getDate() - 7);
    this.lunes.set(d);
    this.loadSemana();
  }

  protected nextSemana(): void {
    const d = new Date(this.lunes());
    d.setDate(d.getDate() + 7);
    this.lunes.set(d);
    this.loadSemana();
  }

  protected openQuickPlan(): void {
    const today = PlanificadorService.toIso(new Date());
    const day = this.dias().find(d => d.isoDate === today) ?? this.dias()[0];
    this.openModal(day.isoDate, 'almuerzo');
  }

  protected openModal(fecha: string, tipo: TipoComida): void {
    this.editingItem.set(null);
    this.openMenuItemId.set(null);
    this.modalSlot.set({
      fecha,
      tipoComida: tipo,
      tituloLibre: '',
      recetaId: '',
      hora: this.DEFAULT_HOURS[tipo],
    });
    this.recipeQuery.set('');
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  protected openEditModal(item: PlanificadorItemDto): void {
    const tipo = item.tipoComida as TipoComida;
    this.editingItem.set(item);
    this.openMenuItemId.set(null);
    this.modalSlot.set({
      fecha: item.fecha,
      tipoComida: tipo,
      tituloLibre: item.tituloLibre ?? '',
      recetaId: item.recetaId ?? '',
      hora: this.formatTime(item.hora) || this.DEFAULT_HOURS[tipo],
    });
    this.recipeQuery.set(item.recetaNombre ?? '');
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.modalSlot.set(null);
    this.editingItem.set(null);
    this.recipeQuery.set('');
  }

  protected closeItemMenu(): void {
    this.openMenuItemId.set(null);
  }

  protected toggleItemMenu(itemId: string, event: Event): void {
    event.stopPropagation();
    this.openMenuItemId.update(current => current === itemId ? null : itemId);
  }

  protected selectRecipe(receta: ApiReceta): void {
    const slot = this.modalSlot();
    if (!slot) return;

    this.modalSlot.set({ ...slot, recetaId: receta.id });
    this.recipeQuery.set(receta.nombre);
    this.errorMessage.set(null);
  }

  protected updateTaskTitle(value: string): void {
    const slot = this.modalSlot();
    if (!slot) return;

    this.modalSlot.set({ ...slot, tituloLibre: value });
    if (value.trim()) this.errorMessage.set(null);
  }

  protected updateSlotTime(value: string): void {
    const slot = this.modalSlot();
    if (!slot) return;

    this.modalSlot.set({ ...slot, hora: value });
  }

  protected saveItem(): void {
    const slot = this.modalSlot();
    if (!slot) return;

    const isTask = slot.tipoComida === 'tarea';
    if (isTask && !slot.tituloLibre.trim()) return;
    if (!isTask && !slot.recetaId) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);
    const req: AddItemRequest | UpdateItemRequest = {
      ...(this.editingItem() ? {} : { fecha: slot.fecha, tipoComida: slot.tipoComida }),
      recetaId: isTask ? null : slot.recetaId,
      tituloLibre: isTask ? slot.tituloLibre.trim() : null,
      hora: slot.hora || null,
    };
    const editing = this.editingItem();
    const request$ = editing
      ? this.svc.updateItem(editing.id, req as UpdateItemRequest)
      : this.svc.addItem(req as AddItemRequest);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: savedItem => {
          const s = this.semana();
          if (s) {
            const items = editing
              ? s.items.map(item => item.id === savedItem.id ? savedItem : item)
              : [...s.items, savedItem];
            this.semana.set({ ...s, items });
          }
          this.isSaving.set(false);
          this.closeModal();
        },
        error: () => {
          this.isSaving.set(false);
          this.errorMessage.set('No se pudo guardar. Revisá que el backend esté actualizado y volvé a intentar.');
        },
      });
  }

  protected deleteItem(itemId: string, event?: Event): void {
    event?.stopPropagation();
    this.openMenuItemId.set(null);
    this.svc.deleteItem(itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const s = this.semana();
          if (s) this.semana.set({ ...s, items: s.items.filter(i => i.id !== itemId) });
        },
        error: () => this.errorMessage.set('No se pudo eliminar el item. Volve a intentar.'),
      });
  }

  protected modalTitle(): string {
    const slot = this.modalSlot();
    if (!slot) return '';

    if (this.editingItem()) {
      return slot.tipoComida === 'tarea' ? 'Editar tarea' : 'Editar comida';
    }

    return slot.tipoComida === 'tarea' ? 'Agregar tarea' : 'Elegir receta';
  }

  protected modalDateLabel(): string {
    const slot = this.modalSlot();
    if (!slot) return '';

    const day = this.dias().find(d => d.isoDate === slot.fecha);
    return day ? `${day.dayName} ${day.dayLabel}` : slot.fecha;
  }

  protected itemTitle(item: PlanificadorItemDto): string {
    return item.recetaNombre ?? item.tituloLibre ?? 'Sin titulo';
  }

  protected itemImage(item: PlanificadorItemDto): string | null {
    return this.resolveImageUrl(item.imagenUrl);
  }

  protected recipeImage(receta: ApiReceta): string | null {
    return this.resolveImageUrl(receta.imagenUrl);
  }

  protected formatTime(hora: string | null): string {
    if (!hora) return '';
    return hora.length >= 5 ? hora.slice(0, 5) : hora;
  }

  protected normalize(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private loadSemana(): void {
    this.isLoading.set(true);
    const fechaInicio = PlanificadorService.toIso(this.lunes());
    this.svc.getSemana(fechaInicio)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: s => {
          this.semana.set(s);
          this.isLoading.set(false);
          this.errorMessage.set(null);
        },
        error: () => {
          this.isLoading.set(false);
          this.errorMessage.set('No se pudo cargar el planificador.');
        },
      });
  }

  private loadRecetas(): void {
    this.isLoadingRecipes.set(true);
    this.recetasSvc.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: recetas => {
          this.recetas.set(recetas);
          this.isLoadingRecipes.set(false);
        },
        error: () => this.isLoadingRecipes.set(false),
      });
  }

  private resolveImageUrl(url: string | null): string | null {
    if (!url) return null;
    if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url;

    const baseUrl = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  }
}
