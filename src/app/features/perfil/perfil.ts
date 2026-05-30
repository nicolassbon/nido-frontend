import { Component } from '@angular/core';
import {StatCard} from "../../shared/ui/stat-card/stat-card";
import {PreferenceCard} from "../../shared/ui/preference-card/preference-card";
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, ReactiveFormsModule, StatCard, PreferenceCard, LucideAngularModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class PerfilComponent {
  // Datos "mockeados" (de prueba) hasta que conectemos el backend
  usuario = {
    nombre: 'Luisa Rodriguez',
    email: 'micaela@gmail.com',
    telefono: '1533447711',
    fechaRegistro: 'Mayo 2024',
    nivel: 'Experta del Hogar',
    alergias: ['Maní', 'Mariscos', 'Lácteos', 'Glúten'],
    noMeGusta: ['Aceitunas', 'Cebolla', 'Pimiento', 'Hígado']
  };
}
