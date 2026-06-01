import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer } from '@angular/platform-browser';

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
  readonly scrolled = signal(false);

  onScroll(): void {
    this.scrolled.set(window.scrollY > 50);
  }
}
