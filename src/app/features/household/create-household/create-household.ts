import { Component, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
  color: string;
  initials: string;
  isCurrentUser?: boolean;
}

@Component({
  selector: 'app-create-household',
  imports: [LucideAngularModule],
  templateUrl: './create-household.html',
  styleUrl: './create-household.scss',
})
export class CreateHousehold {
  readonly steps = [
    { number: 1, label: 'Tu cuenta',    completed: true,  active: false },
    { number: 2, label: 'Tu hogar',     completed: false, active: true  },
    { number: 3, label: 'Preferencias', completed: false, active: false },
    { number: 4, label: 'Finalizar',    completed: false, active: false },
  ];

  readonly members = signal<FamilyMember[]>([
    { id: '1', name: 'Nico',  role: 'Tú',      color: '#263F30', initials: 'N', isCurrentUser: true },
    { id: '2', name: 'Abi',   role: 'Pareja',  color: '#C78F5A', initials: 'A' },
    { id: '3', name: 'Lauti', role: 'Hermano', color: '#927357', initials: 'L' },
  ]);

  readonly sortedMembers = computed(() => {
    const list = this.members();
    const me = list.find(m => m.isCurrentUser);
    const others = list.filter(m => !m.isCurrentUser);
    return me ? [me, ...others] : others;
  });

  readonly openMenuId = signal<string | null>(null);

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.update(cur => cur === id ? null : id);
  }

  closeMenus(): void {
    this.openMenuId.set(null);
  }

  removeMember(id: string): void {
    this.members.update(list => list.filter(m => m.id !== id));
    this.openMenuId.set(null);
  }

  addMember(): void {
    // TODO: open add-member modal
  }

  next(): void {
    // TODO: navigate to step 3
  }

  skip(): void {
    // TODO: skip to next step
  }

  stepCircleClass(step: { completed: boolean; active: boolean }): string {
    if (step.completed || step.active) {
      return 'w-8 h-8 rounded-full bg-nido-cream flex items-center justify-center shrink-0';
    }
    return 'w-8 h-8 rounded-full border-2 border-solid border-[rgba(247,241,230,0.35)] flex items-center justify-center shrink-0';
  }

  stepLabelClass(step: { active: boolean }): string {
    return step.active
      ? 'text-[0.65rem] whitespace-nowrap text-nido-cream font-semibold'
      : 'text-[0.65rem] whitespace-nowrap text-[rgba(247,241,230,0.45)]';
  }
}
