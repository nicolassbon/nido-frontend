import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductService } from '../../core/servicios/agregar-producto.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-agregar-producto',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agregar-producto.html',
  styleUrl: './agregar-producto.scss',
})
export class AgregarProducto {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  private readonly HOGAR_ID = environment.devHogarId;
  private readonly USUARIO_ID = environment.devUsuarioId;

  protected readonly categorias = [
    { id: '33333333-3333-3333-3333-333333333333', nombre: 'General' },
    { id: '44444444-4444-4444-4444-444444444444', nombre: 'Lacteos' },
    { id: '55555555-5555-5555-5555-555555555555', nombre: 'Bebidas' },
    { id: '66666666-6666-6666-6666-666666666666', nombre: 'Congelados' },
    { id: '77777777-7777-7777-7777-777777777777', nombre: 'Despensa' },
  ];

  form = this.fb.group({
    nombre: ['', Validators.required],
    categoriaId: ['', Validators.required],
    cantidad: [1, Validators.required],
    unidadMedida: ['', Validators.required],
    fechaVencimiento: [''],
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      nombre: this.form.value.nombre!,
      categoriaId: this.form.value.categoriaId!,
      cantidad: this.form.value.cantidad!,
      unidadMedida: this.form.value.unidadMedida!,
      fechaVencimiento: this.form.value.fechaVencimiento || undefined,
      hogarId: this.HOGAR_ID,
      usuarioId: this.USUARIO_ID,
    };

    this.productService.createStockHome(payload).subscribe({
      next: (res) => {
        console.log('Producto creado:', res);
        this.form.reset({ cantidad: 1 });
        this.router.navigate(['/alacena']);
      },
      error: (err) => {
        console.error('Error:', err);
      },
    });
  }
}
