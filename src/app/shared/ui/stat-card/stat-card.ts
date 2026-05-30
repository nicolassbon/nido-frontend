import { Component, Input } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-stat-card',
  imports: [LucideAngularModule],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  @Input() icon: string = '';
  @Input() value: string | number = 0;
  @Input() title: string = '';
  @Input() subtitle: string = '';

}
