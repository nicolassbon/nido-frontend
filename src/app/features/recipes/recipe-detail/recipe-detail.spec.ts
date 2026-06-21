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

  it('usa la compra estandar al agregar faltantes a la lista', () => {
    setRecipe({
      nombre: 'Pollo al curry',
      ingredientes: [
        {
          id: 'ing-1',
          productoId: 'prod-1',
          nombre: 'Ajo en polvo',
          productoNombre: 'Ajo en polvo',
          cantidad: 1,
          unidad: 'cda',
          cantidadCompraEstandar: 1,
          unidadCompraEstandar: 'unidad',
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Pollo al curry', [
      {
        nombre: 'Ajo en polvo',
        cantidad: 1,
        unidad: 'unidad',
      },
    ]);
    expect(router.navigate).toHaveBeenCalledWith(['/lista-compras']);
  });

  it('mantiene la unidad original cuando no hay compra estandar', () => {
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
          enStock: false,
          alergenos: [],
        },
      ],
    });

    (component as any).agregarFaltantesALista();

    expect(listaService.addGroupToLista).toHaveBeenCalledWith('Salsa', [
      {
        nombre: 'Pimienta',
        cantidad: 1,
        unidad: 'pizca',
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
