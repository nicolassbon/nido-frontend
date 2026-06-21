import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export interface ProgressStep {
  number: number;
  label: string; // Format: "Title - Description"
  completed: boolean;
  active: boolean;
}

@Component({
  selector: 'app-progress-steps',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './progress-steps.component.html',
  styleUrl: './progress-steps.component.scss',
})
export class ProgressStepsComponent {
  @Input() steps: ProgressStep[] = [];

  getStepCircleClass(step: ProgressStep): string {
    if (step.completed) {
      return 'bg-nido-green text-white';
    }
    if (step.active) {
      return 'bg-nido-green-dark text-white';
    }
    return 'bg-white text-nido-brown border-2 border-nido-cream';
  }

  getStepIcon(step: ProgressStep): string {
    const icons: { [key: number]: string } = {
      1: 'user',
      2: 'home',
      3: 'plug-2',
      4: 'star',
    };
    return icons[step.number] || 'circle';
  }
}
