import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer } from '@angular/platform-browser';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  host: { '(window:scroll)': 'onScroll()' },
})
export class Landing {
  private readonly sanitizer = inject(DomSanitizer);
  readonly heroBg = this.sanitizer.bypassSecurityTrustStyle("url('images/hero.png')");
  readonly scrolled      = signal(false);
  readonly activeSection = signal<string>('inicio');
  readonly activeFaq     = signal<number | null>(null);

  private readonly navSections = ['inicio', 'beneficios', 'funciones', 'precios', 'faq'];

  readonly faqItems: FaqItem[] = [
    {
      question: '¿Es necesario pagar para usar Nido?',
      answer: 'No. Nido es completamente gratuito. Solo necesitás crear una cuenta para empezar a organizar tu hogar de inmediato, sin cargos ni compromisos.',
    },
    {
      question: '¿Puedo usarlo con toda mi familia?',
      answer: 'Sí. Podés invitar a todos los miembros de tu hogar. Cada uno tiene su perfil con alérgenos y preferencias propias, y comparten el inventario en tiempo real.',
    },
    {
      question: '¿Qué pasa si no tengo el código de barras de un producto?',
      answer: 'Podés agregar productos manualmente ingresando nombre, categoría, cantidad y fecha de vencimiento. También podés buscarlo directamente en nuestra base de datos.',
    },
    {
      question: '¿Cómo funciona el sistema de recetas?',
      answer: 'Nido cruza automáticamente los ingredientes de cada receta con tu alacena real. Las recetas se ordenan por disponibilidad de ingredientes, y podés filtrar por alérgenos de los presentes y por los electrodomésticos que tenés.',
    },
    {
      question: '¿Mis datos están seguros?',
      answer: 'Sí. Tu información está cifrada y almacenada de forma segura. Nunca compartimos tus datos con terceros bajo ninguna circunstancia.',
    },
  ];

  onScroll(): void {
    this.scrolled.set(window.scrollY > 50);

    // Scroll-spy: activa el link cuya sección ocupa el viewport
    const threshold = window.innerHeight * 0.38;
    let current = 'inicio';

    for (const id of this.navSections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= threshold) {
        current = id;
      }
    }

    this.activeSection.set(current);
  }

  toggleFaq(index: number): void {
    this.activeFaq.update(current => current === index ? null : index);
  }
}
