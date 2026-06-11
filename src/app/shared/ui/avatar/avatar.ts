import { Component, computed, signal, input, ChangeDetectionStrategy, effect, untracked } from '@angular/core';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (fotoUrl() && !imgError()) {
      <img
        [src]="fotoUrl()"
        [alt]="nombre() || 'Usuario'"
        (error)="handleImgError()"
        [class]="'rounded-full object-cover ' + sizeClass()"
      />
    } @else {
      <div
        [style.backgroundColor]="avatarStyles().bg"
        [style.color]="avatarStyles().text"
        [class]="'rounded-full flex items-center justify-center font-bold font-title uppercase select-none border border-nido-border/20 ' + sizeClass() + ' ' + fontSizeClass()"
      >
        {{ initials() }}
      </div>
    }
  `
})
export class Avatar {
  readonly nombre = input<string | null | undefined>('');
  readonly fotoUrl = input<string | null | undefined>(null);
  readonly sizeClass = input<string>('w-10 h-10');
  readonly fontSizeClass = input<string>('text-sm');

  protected readonly imgError = signal(false);

  constructor() {
    effect(() => {
      this.fotoUrl();
      untracked(() => {
        this.imgError.set(false);
      });
    });
  }

  protected readonly initials = computed(() => {
    const name = this.nombre();
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  protected readonly avatarStyles = computed(() => {
    const name = this.nombre() || '';
    const colors = [
      { bg: '#1F3A3A', text: '#EADCC9' },
      { bg: '#2B4A47', text: '#EADCC9' },
      { bg: '#B48B6A', text: '#1F3A3A' },
      { bg: '#7A5A45', text: '#EADCC9' },
      { bg: '#b44c3c', text: '#ffffff' }
    ];
    if (!name) {
      return colors[0];
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  });

  protected handleImgError(): void {
    this.imgError.set(true);
  }
}
