import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductService } from '../../core/servicios/agregar-producto.service';
import { environment } from '../../../environments/environment';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './agregar-producto.html',
  styleUrl: './agregar-producto.scss',
})
export class AgregarProducto {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private get HOGAR_ID(): string { return this.authService.getHogarId() ?? environment.devHogarId; }
  private get USUARIO_ID(): string { return this.authService.getUserId() ?? environment.devUsuarioId; }

  protected isSaving = false;
  protected errorMessage = '';

  protected readonly categorias = [
    { id: '33333333-3333-3333-3333-333333333333', nombre: 'General' },
    { id: '44444444-4444-4444-4444-444444444444', nombre: 'Lacteos' },
    { id: '55555555-5555-5555-5555-555555555555', nombre: 'Bebidas' },
    { id: '66666666-6666-6666-6666-666666666666', nombre: 'Congelados' },
    { id: '77777777-7777-7777-7777-777777777777', nombre: 'Despensa' },
  ];

  protected readonly unidadesMedida = [
    'unidad',
    'gr',
    'kg',
    'ml',
    'lt',
    'cdita',
    'cda',
  ];

  protected readonly ubicaciones = [
    'Alacena',
    'Freezer',
    'Heladera',
  ];

  form = this.fb.group({
    nombre: ['', Validators.required],
    categoriaId: ['', Validators.required],
    ubicacion: ['Alacena', Validators.required],
    cantidad: [1, Validators.required],
    unidadMedida: ['', Validators.required],
    fechaVencimiento: [''],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload = {
      nombre: this.form.value.nombre!,
      categoriaId: this.form.value.categoriaId!,
      ubicacion: this.form.value.ubicacion!,
      cantidad: this.form.value.cantidad!,
      unidadMedida: this.form.value.unidadMedida!,
      fechaVencimiento: this.form.value.fechaVencimiento || undefined,
      hogarId: this.HOGAR_ID,
      usuarioId: this.USUARIO_ID,
    };

    this.productService.createStockHome(payload).subscribe({
      next: (res) => {
        console.log('Producto creado:', res);
        this.form.reset({ cantidad: 1, ubicacion: 'Alacena' });
        this.isSaving = false;
        this.router.navigate(['/alacena']);
      },
      error: (err) => {
        console.error('Error:', err);
        this.errorMessage = 'No se pudo guardar el producto.';
        this.isSaving = false;
      },
    });
  }
}
