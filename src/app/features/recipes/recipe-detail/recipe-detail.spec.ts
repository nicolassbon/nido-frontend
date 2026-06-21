import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { RecipeDetail } from './recipe-detail';
import { RecipesApiService, ApiReceta } from '../recipes/services/recipes-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductService } from '../../../core/servicios/agregar-producto.service';
import { ListaComprasService } from '../../lista-compras/lista-compras.service';
import { ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';

describe('RecipeDetail', () => {
  let component: RecipeDetail;
  let fixture: ComponentFixture<RecipeDetail>;
  let recipesApi: Pick<RecipesApiService, 'getById' | 'cocinar' | 'save' | 'unsave'>;
  let listaService: Pick<ListaComprasService, 'addGroupToLista'>;
  let router: Pick<Router, 'navigate'>;
  let currentRecipe: ApiReceta;
  let addGroupCalls: unknown[][];
  let navigateCalls: unknown[][];

  beforeEach(async () => {
    currentRecipe = buildRecipe();
    addGroupCalls = [];
    navigateCalls = [];

    recipesApi = {
      getById: () => of(currentRecipe),
      cocinar: () => of({ recetaId: 'receta-1', vecesCocinada: 1 }),
      save: () => of(void 0),
      unsave: () => of(void 0),
    };
    listaService = {
      addGroupToLista: (...args: unknown[]) => {
        addGroupCalls.push(args);
        return of([]);
      },
    };
    router = {
      navigate: (...args: unknown[]) => {
        navigateCalls.push(args);
        return Promise.resolve(true);
      },
    };

    await TestBed.configureTestingModule({
      imports: [RecipeDetail],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'receta-1' })) } },
        { provide: Router, useValue: router },
        { provide: RecipesApiService, useValue: recipesApi },
        { provide: AuthService, useValue: { getHogarId: () => 'hogar-1' } },
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

  it('usa compra estandar al agregar faltantes a la lista', () => {
    currentRecipe = buildRecipe({
      ingredientes: [
        {
          id: 'ing-1',
          productoId: 'prod-1',
          nombre: 'Arroz',
          productoNombre: 'Arroz',
          cantidad: 200,
          unidad: 'g',
          cantidadCompraEstandar: 1,
          unidadCompraEstandar: 'kg',
          enStock: false,
        },
      ],
    });

    recreateComponent();

    (component as any).agregarFaltantesALista();

    expect(addGroupCalls).toEqual([['Receta demo', [
      { nombre: 'Arroz', cantidad: 1, unidad: 'kg' },
    ]]]);
    expect(navigateCalls).toEqual([[['/lista-compras']]]);
  });

  it('mantiene la medida original si el ingrediente no tiene compra estandar', () => {
    currentRecipe = buildRecipe({
      ingredientes: [
        {
          id: 'ing-2',
          productoId: 'prod-2',
          nombre: 'Ajo en polvo',
          productoNombre: 'Ajo en polvo',
          cantidad: 1,
          unidad: 'cda',
          cantidadCompraEstandar: null,
          unidadCompraEstandar: null,
          enStock: false,
        },
      ],
    });

    recreateComponent();

    (component as any).agregarFaltantesALista();

    expect(addGroupCalls).toEqual([['Receta demo', [
      { nombre: 'Ajo en polvo', cantidad: 1, unidad: 'cda' },
    ]]]);
  });

  function recreateComponent(): void {
    addGroupCalls = [];
    navigateCalls = [];
    fixture = TestBed.createComponent(RecipeDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
