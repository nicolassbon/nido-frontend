import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-preference-card',
  imports: [LucideAngularModule],
  templateUrl: './preference-card.html',
  styleUrl: './preference-card.scss',
})
export class PreferenceCard {
  @Input() title: string = '';
  @Input() icon: string = '';
  @Input() tag: string[] = [];
  @Output() editClick = new EventEmitter<void>();
}
