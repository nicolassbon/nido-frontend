import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, ViewChild, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ChefHat,
  LucideAngularModule,
  SendHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-angular';
import { environment } from '../../../../environments/environment';

export interface MensajeHistorial {
  role: 'user' | 'model';
  text: string;
}

export interface AssistantRecipeContext {
  id: string | null;
  nombre: string;
  ingredientes: string[];
  faltantes: string[];
}

@Component({
  selector: 'app-receta-asistente',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="flex flex-col h-full bg-white relative">
      <header class="flex items-center justify-between border-b border-nido-border/30 px-4 py-3 bg-[#fdf9f3] shrink-0">
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-nido-cream text-nido-green-dark">
            <lucide-icon [img]="icons.Sparkles" [size]="16" class="text-nido-gold animate-pulse" />
          </span>
          <div class="text-left">
            <h3 class="text-[0.875rem] font-bold text-nido-green-dark m-0 leading-tight">Asistente Chef Nido</h3>
            <p class="text-[0.68rem] text-nido-brown m-0">Ideas y ayuda en tiempo real</p>
          </div>
        </div>

        @if (historial().length > 0) {
          <button
            type="button"
            class="p-1.5 rounded-md text-nido-brown/60 hover:text-nido-red hover:bg-nido-red/10 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
            (click)="limpiarHistorial()"
            title="Limpiar chat">
            <lucide-icon [img]="icons.Trash2" [size]="14" />
          </button>
        }
      </header>

      <div
        #chatContainer
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 bg-[#faf6f0]/30 scroll-smooth">

        @if (historial().length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center text-center px-4 gap-3.5 my-auto">
            <div class="w-12 h-12 rounded-full bg-nido-cream flex items-center justify-center text-nido-green-dark">
              <lucide-icon [img]="icons.ChefHat" [size]="24" />
            </div>
            <div>
              <p class="text-[0.85rem] font-semibold text-nido-green-dark m-0">Hola, soy tu asistente de cocina</p>
              @if (recetaContexto(); as receta) {
                <p class="text-[0.75rem] text-nido-brown mt-1 max-w-[250px] mx-auto leading-relaxed">
                  Preguntame por ideas, ajustes o consejos para <strong>{{ receta.nombre }}</strong>.
                </p>
              } @else {
                <p class="text-[0.75rem] text-nido-brown mt-1 max-w-[250px] mx-auto leading-relaxed">
                  Preguntame ideas, reemplazos o comidas segun tu objetivo.
                </p>
              }
            </div>

            <div class="flex flex-col gap-2 w-full max-w-[260px] mt-2">
              @if (recetaContexto()) {
                <button
                  type="button"
                  (click)="preguntarRapido('Como puedo ajustar esta receta a mis gustos o necesidades?')"
                  class="text-[0.72rem] px-3 py-2 rounded-lg border border-nido-border/60 bg-white text-nido-green-dark font-medium hover:bg-nido-cream transition-colors text-left cursor-pointer shadow-sm">
                  Ajustar esta receta...
                </button>
                <button
                  type="button"
                  (click)="preguntarRapido('Que consejos me das para preparar mejor esta receta?')"
                  class="text-[0.72rem] px-3 py-2 rounded-lg border border-nido-border/60 bg-white text-nido-green-dark font-medium hover:bg-nido-cream transition-colors text-left cursor-pointer shadow-sm">
                  Consejos para prepararla...
                </button>
              } @else {
                <button
                  type="button"
                  (click)="preguntarRapido('Necesito una idea de comida segun mi objetivo, que puedo preparar?')"
                  class="text-[0.72rem] px-3 py-2 rounded-lg border border-nido-border/60 bg-white text-nido-green-dark font-medium hover:bg-nido-cream transition-colors text-left cursor-pointer shadow-sm">
                  Idea segun mi objetivo...
                </button>
              }
            </div>
          </div>
        } @else {
          @for (msg of historial(); track $index) {
            <div
              class="flex flex-col max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[0.8rem] leading-relaxed shadow-sm"
              [class.self-end]="msg.role === 'user'"
              [class.bg-nido-green-dark]="msg.role === 'user'"
              [class.text-nido-cream]="msg.role === 'user'"
              [class.rounded-tr-none]="msg.role === 'user'"
              [class.self-start]="msg.role === 'model'"
              [class.bg-white]="msg.role === 'model'"
              [class.text-nido-green-dark]="msg.role === 'model'"
              [class.border]="msg.role === 'model'"
              [class.border-nido-border/50]="msg.role === 'model'"
              [class.rounded-tl-none]="msg.role === 'model'">
              <p class="m-0 whitespace-pre-wrap font-medium">{{ msg.text }}</p>
            </div>
          }
        }

        @if (loading()) {
          <div class="self-start max-w-[80%] rounded-[12px] rounded-tl-none px-3.5 py-2.5 text-[0.78rem] bg-white border border-nido-border/40 flex items-center gap-2 shadow-sm">
            <span class="flex gap-1 shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-nido-green animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-nido-green animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-nido-green animate-bounce" style="animation-delay: 300ms"></span>
            </span>
            <span class="text-nido-brown italic">Pensando...</span>
          </div>
        }
      </div>

      <form (submit)="enviarMensaje($event)" class="p-3 border-t border-nido-border/30 bg-white shrink-0 flex items-center gap-2">
        <input
          type="text"
          [placeholder]="recetaContexto() ? 'Ej: Quiero ajustar esta receta' : 'Ej: Quiero una comida liviana'"
          class="flex-1 px-3 py-2 border border-solid border-nido-border rounded-[10px] text-[0.78rem] text-nido-green-dark bg-white outline-none focus:border-nido-green-dark transition-colors duration-150 disabled:bg-[#fcfaf7]"
          [disabled]="loading()"
          [(ngModel)]="userInput"
          name="userInput"
          autocomplete="off" />

        <button
          type="submit"
          class="w-8 h-8 shrink-0 rounded-[10px] bg-nido-green-dark hover:bg-nido-green text-nido-cream flex items-center justify-center cursor-pointer transition-colors border-0 disabled:opacity-40 disabled:cursor-not-allowed"
          [disabled]="loading() || !userInput().trim()">
          <lucide-icon [img]="icons.SendHorizontal" [size]="14" />
        </button>
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
})
export class RecetaAsistenteComponent {
  private readonly http = inject(HttpClient);

  readonly recetaContexto = input<AssistantRecipeContext | null>(null);
  readonly alacena = input<string[]>([]);

  readonly historial = signal<MensajeHistorial[]>([]);
  readonly userInput = signal('');
  readonly loading = signal(false);

  readonly icons = {
    Sparkles,
    Trash2,
    ChefHat,
    SendHorizontal,
  };

  @ViewChild('chatContainer') private chatContainer?: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      if (this.historial().length > 0 || this.loading()) {
        this.scrollToBottom();
      }
    });
  }

  enviarMensaje(event?: Event): void {
    event?.preventDefault();

    const preguntaText = this.userInput().trim();
    if (!preguntaText || this.loading()) return;

    const historialPrevio = [...this.historial()];
    this.historial.update(list => [...list, { role: 'user', text: preguntaText }]);
    this.userInput.set('');
    this.loading.set(true);

    const payload = {
      pregunta: preguntaText,
      receta: this.recetaContexto(),
      alacena: this.alacena(),
      historial: historialPrevio,
    };

    this.http.post<{ respuesta: string }>(`${environment.apiBaseUrl}/recetas/ia/asistente`, payload)
      .subscribe({
        next: res => {
          this.historial.update(list => [...list, { role: 'model', text: res.respuesta }]);
          this.loading.set(false);
        },
        error: err => {
          console.error('Error al conectar con la IA de Nido:', err);
          this.historial.update(list => [
            ...list,
            { role: 'model', text: 'No me pude conectar con el asistente culinario. Intenta de nuevo en unos instantes.' },
          ]);
          this.loading.set(false);
        },
      });
  }

  preguntarRapido(texto: string): void {
    this.userInput.set(texto);
    this.enviarMensaje();
  }

  limpiarHistorial(): void {
    this.historial.set([]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.chatContainer?.nativeElement;
      if (!element) return;
      element.scrollTop = element.scrollHeight;
    }, 100);
  }
}
