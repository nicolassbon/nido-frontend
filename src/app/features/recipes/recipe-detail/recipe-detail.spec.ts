import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../../app.config';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductService } from '../../../core/servicios/agregar-producto.service';
import { ListaComprasService } from '../../lista-compras/lista-compras.service';
import { ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';
import { RecipeDetail } from './recipe-detail';
import { ApiReceta, RecipesApiService } from '../recipes/services/recipes-api.service';

describe('RecipeDetail', () => {
  let component: RecipeDetail;
  let fixture: ComponentFixture<RecipeDetail>;
  let router: Pick<Router, 'navigate'>;
  let listaService: Pick<ListaComprasService, 'addGroupToLista'>;

  beforeEach(async () => {
    router = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    listaService = {
      addGroupToLista: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [RecipeDetail],
      providers: [
        ...appConfig.providers,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: router },
        {
          provide: RecipesApiService,
          useValue: {
            getById: vi.fn(),
            cocinar: vi.fn(),
            save: vi.fn(),
            unsave: vi.fn(),
          },
        },
        { provide: AuthService, useValue: { getHogarId: () => null } },
        { provide: ProductService, useValue: { getProductManual: () => of([]) } },
        { provide: ListaComprasService, useValue: listaService },
        { provide: ElectrodomesticosService, useValue: { getAll: () => of([]) } },
      ],
    })
      .overrideComponent(RecipeDetail, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RecipeDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('usa la cantidad convertida para lista al agregar faltantes', () => {
    setRecipe({
      nombre: 'Limonada',
      ingredientes: [
        {
          id: 'ing-1',
          productoId: 'prod-1',
          nombre: 'Agua',
          productoNombre: 'Agua',
          cantidad: 2,
          unidad: 'taza',
          cantidadCompraEstandar: 1,
          unidadCompraEstandar: 'lt',
          cantidadListaCompras: 480,
          unidadListaCompras: 'ml',
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Limonada', [
      {
        nombre: 'Agua',
        cantidad: 480,
        unidad: 'ml',
      },
    ]);
    expect(router.navigate).toHaveBeenCalledWith(['/lista-compras']);
  });

  it('omite la cantidad y unidad cuando no hay compra estandar y la unidad original es de cocina (e.g. pizca)', () => {
    setRecipe({
      nombre: 'Salsa',
      ingredientes: [
        {
          id: 'ing-2',
          productoId: null,
          nombre: 'Pimienta',
          productoNombre: null,
          cantidad: 1,
          unidad: 'pizca',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          cantidadListaCompras: null,
          unidadListaCompras: null,
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Salsa', [
      {
        nombre: 'Pimienta',
        cantidad: null,
        unidad: null,
      },
    ]);
  });

  it('mantiene la unidad original cuando no hay compra estandar y la unidad es de compra (e.g. kg)', () => {
    setRecipe({
      nombre: 'Guiso',
      ingredientes: [
        {
          id: 'ing-3',
          productoId: null,
          nombre: 'Carne picada',
          productoNombre: null,
          cantidad: 0.5,
          unidad: 'kg',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Guiso', [
      {
        nombre: 'Carne',
        cantidad: 0.5,
        unidad: 'kg',
      },
    ]);
  });

  it('limpia instrucciones de preparacion del nombre del ingrediente', () => {
    setRecipe({
      nombre: 'Ensalada',
      ingredientes: [
        {
          id: 'ing-4',
          productoId: null,
          nombre: 'Zucchini cortado en trozos chicos',
          productoNombre: null,
          cantidad: 2,
          unidad: 'unidad',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Ensalada', [
      {
        nombre: 'Zucchini',
        cantidad: 2,
        unidad: 'unidad',
      },
    ]);
  });

  it('limpia frases como fresca para decorar y molida en orden del primer match', () => {
    setRecipe({
      nombre: 'Cena',
      ingredientes: [
        {
          id: 'ing-5',
          productoId: null,
          nombre: 'Albahaca fresca para decorar',
          productoNombre: null,
          cantidad: 1,
          unidad: 'unidad',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        },
        {
          id: 'ing-6',
          productoId: null,
          nombre: 'Pimienta de Jamaica molida',
          productoNombre: null,
          cantidad: 1,
          unidad: 'unidad',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        }
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Cena', [
      {
        nombre: 'Albahaca',
        cantidad: 1,
        unidad: 'unidad',
      },
      {
        nombre: 'Pimienta de Jamaica',
        cantidad: 1,
        unidad: 'unidad',
      }
    ]);
  });

  it('omite la cantidad cuando no hay unidad y la cantidad es fraccionaria (e.g. 0.5 almendras crudas)', () => {
    setRecipe({
      nombre: 'Postre',
      ingredientes: [
        {
          id: 'ing-7',
          productoId: null,
          nombre: 'Almendras crudas',
          productoNombre: null,
          cantidad: 0.5,
          unidad: null,
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Postre', [
      {
        nombre: 'Almendras crudas',
        cantidad: null,
        unidad: null,
      },
    ]);
  });

  it('mantiene la cantidad cuando no hay unidad pero es un valor entero (e.g. 2 limones)', () => {
    setRecipe({
      nombre: 'Bebida',
      ingredientes: [
        {
          id: 'ing-8',
          productoId: null,
          nombre: 'Limón',
          productoNombre: null,
          cantidad: 2,
          unidad: null,
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Bebida', [
      {
        nombre: 'Limón',
        cantidad: 2,
        unidad: null,
      },
    ]);
  });

  function setRecipe(partial: Pick<ApiReceta, 'nombre' | 'ingredientes'>): void {
    (component as any).pantryNames.set([]);
    (component as any).recipe.set({
      id: 'receta-1',
      nombre: partial.nombre,
      descripcion: null,
      tiempoCoccionMin: null,
      dificultad: null,
      porciones: null,
      fuenteId: null,
      imagenUrl: null,
      calorias: null,
      proteinas: null,
      carbohidratos: null,
      grasas: null,
      ingredientes: partial.ingredientes,
      pasos: [],
      electrodomesticos: [],
      guardada: false,
    } as ApiReceta);
  }
});

function buildRecipe(overrides: Partial<ApiReceta> = {}): ApiReceta {
  return {
    id: 'receta-1',
    nombre: 'Receta demo',
    descripcion: null,
    tiempoCoccionMin: 20,
    dificultad: 'facil',
    porciones: 2,
    fuenteId: 'manual',
    imagenUrl: null,
    calorias: null,
    proteinas: null,
    carbohidratos: null,
    grasas: null,
    ingredientes: [],
    pasos: [],
    electrodomesticos: [],
    guardada: false,
    ...overrides,
  };
}
