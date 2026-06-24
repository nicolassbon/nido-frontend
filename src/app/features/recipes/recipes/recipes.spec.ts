import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  AlarmClock,
  AlertTriangle,
  Bookmark,
  Check,
  CheckSquare,
  ChefHat,
  ChevronDown,
  Clock,
  Eye,
  Flame,
  LUCIDE_ICONS,
  LucideIconProvider,
  Pencil,
  Search,
  Shield,
  ShoppingBasket,
  Shuffle,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from 'lucide-angular';
import { Recipes } from './recipes';
import { RecipesApiService, ApiReceta } from './services/recipes-api.service';
import { ProductService, ProductManualResponse } from '../../../core/servicios/agregar-producto.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ElectrodomesticosService } from '../../electrodomesticos/services/electrodomesticos.service';
import { HogaresApiService, MiembroResponse } from '../../household/hogares-api.service';
import { PerfilApiService } from '../../perfil/perfil-api.service';

const HOGAR_ID = 'test-hogar-id';

const makeReceta = (
  id: string,
  nombre: string,
  ingredientes: ApiReceta['ingredientes'],
  overrides: Partial<ApiReceta> = {},
): ApiReceta => ({
  id, nombre, ingredientes,
  descripcion: null, tiempoCoccionMin: 30, dificultad: 'Fácil', porciones: 2,
  fuenteId: null, imagenUrl: null, calorias: 200,
  proteinas: null, carbohidratos: null, grasas: null,
  ...overrides,
});

const mockRecetaArroz = makeReceta('r1', 'Arroz con leche', [
  { id: 'i1', productoId: 'p1', nombre: 'Arroz', productoNombre: 'Arroz', cantidad: 200, unidad: 'g', enStock: true },
  { id: 'i2', productoId: 'p2', nombre: 'Leche', productoNombre: 'Leche', cantidad: 500, unidad: 'ml', enStock: false },
]);

const mockRecetaPasta = makeReceta('r2', 'Pasta con salsa', [
  { id: 'i3', productoId: 'p3', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: false },
  { id: 'i4', productoId: 'p4', nombre: 'Tomate', productoNombre: 'Tomate', cantidad: 300, unidad: 'g', enStock: false },
]);

const makePantry = (
  stockHogarId: string,
  productoId: string,
  nombre: string,
  cantidad = 100,
): ProductManualResponse => ({
  stockHogarId, productoId, nombre, cantidad,
  categoriaId: null, categoriaNombre: null, codigoBarras: null, imagenUrl: null,
  ubicacion: 'despensa', unidadMedida: 'gramos', fechaVencimiento: null,
  estaAbierto: false, porcentajeConsumido: 0, cantidadEnvases: 1,
});

const arrozPantry = makePantry('s1', 'p1', 'Arroz');
const lechePantry = makePantry('s2', 'p2', 'Leche');
const fideoPantry = makePantry('s3', 'p3', 'Fideos');

describe('Recipes', () => {
  let fixture:   ComponentFixture<Recipes>;
  let component: Recipes;

  const recipesApiMock          = { getAll:           vi.fn() };
  const productSvcMock          = { getProductManual: vi.fn(), createStockHome: vi.fn() };
  const authServiceMock         = { getHogarId:       vi.fn(), getUserId: vi.fn() };
  const electrodomesticosMock   = { getAll:           vi.fn() };
  const hogaresApiMock          = { getMiembros:      vi.fn() };
  const perfilApiMock           = { getProfile:       vi.fn() };

  async function setup(
    recetas: ApiReceta[]             = [],
    pantry:  ProductManualResponse[] = [],
    hogarId: string | null           = HOGAR_ID,
    miembros: MiembroResponse[]      = [],
    electrodomesticos: unknown[]     = [],
    profileAllergies: string[]       = [],
    profileFoodRestrictions: string[] = [],
  ): Promise<void> {
    recipesApiMock.getAll.mockReturnValue(of(recetas));
    productSvcMock.getProductManual.mockReturnValue(of(pantry));
    authServiceMock.getHogarId.mockReturnValue(hogarId);
    authServiceMock.getUserId.mockReturnValue('u1');
    hogaresApiMock.getMiembros.mockReturnValue(of(miembros));
    electrodomesticosMock.getAll.mockReturnValue(of(electrodomesticos));
    perfilApiMock.getProfile.mockReturnValue(of({
      alergias: profileAllergies,
      alimentacion: profileFoodRestrictions,
    }));

    await TestBed.configureTestingModule({
      imports:   [Recipes],
      schemas:   [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: RecipesApiService,       useValue: recipesApiMock        },
        { provide: ProductService,          useValue: productSvcMock        },
        { provide: AuthService,             useValue: authServiceMock       },
        { provide: ElectrodomesticosService, useValue: electrodomesticosMock },
        { provide: HogaresApiService,       useValue: hogaresApiMock        },
        { provide: PerfilApiService,        useValue: perfilApiMock         },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            AlarmClock,
            AlertTriangle,
            Bookmark,
            Check,
            CheckSquare,
            ChefHat,
            ChevronDown,
            Clock,
            Eye,
            Flame,
            Pencil,
            Search,
            Shield,
            ShoppingBasket,
            Shuffle,
            SlidersHorizontal,
            Star,
            X,
            Zap,
          }),
        },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(Recipes);
    component = fixture.componentInstance;

    component.ngOnInit();
  }

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('debería crearse correctamente', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('debería llamar a getProductManual al cargar cuando hay hogarId', async () => {
    await setup();
    expect(productSvcMock.getProductManual).toHaveBeenCalled();
  });

  it('no debería llamar a getProductManual si el JWT no tiene hogarId', async () => {
    await setup([], [], null);
    expect(productSvcMock.getProductManual).not.toHaveBeenCalled();
  });

  it('debería poblar pantryIngredients con los productos de la alacena', async () => {
    await setup([], [arrozPantry]);

    const pantry = component['pantryIngredients']();
    expect(pantry).toHaveLength(1);
    expect(pantry[0].name).toBe('Arroz');
    expect(pantry[0].amount).toBe('100 g');
    expect(pantry[0].selected).toBe(true);
  });

  it('debería dejar pantryIngredients vacío si la alacena no tiene productos', async () => {
    await setup([], []);
    expect(component['pantryIngredients']()).toHaveLength(0);
  });

  it('debería calcular 50% cuando la pantry tiene Arroz seleccionado (1 de 2 ingredientes)', async () => {
    await setup([mockRecetaArroz], [arrozPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);
  });

  it('debería calcular 0% cuando la pantry tiene Fideos pero la receta pide Arroz y Leche', async () => {
    await setup([mockRecetaArroz], [fideoPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  it('debería calcular 0% cuando ningún ingrediente matchea por nombre', async () => {
    await setup([mockRecetaPasta], [arrozPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  it('debería usar inStock del backend cuando la alacena está vacía', async () => {
    await setup([mockRecetaArroz], []);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);
  });

  it('debería matchear ingredientes con nombres parciales (fuzzy)', async () => {
    const arrozIntegral = makePantry('sx', 'px', 'Arroz integral');
    await setup([mockRecetaArroz], [arrozIntegral]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBeGreaterThan(0);
  });

  it('debería calcular 0% cuando todos los ingredientes de la pantry están deseleccionados', async () => {
    await setup([mockRecetaArroz], [arrozPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);

    component['toggleIngredient'](0);

    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  it('buscarPorIngredientes debería activar el filtro', async () => {
    await setup();
    expect(component['filterByIngredients']()).toBe(false);

    component['buscarPorIngredientes']();

    expect(component['filterByIngredients']()).toBe(true);
  });

  it('buscarPorIngredientes debería cambiar el orden a coincidencia si era default', async () => {
    await setup();
    component['setSort']('default');
    expect(component['sortBy']()).toBe('default');

    component['buscarPorIngredientes']();

    expect(component['sortBy']()).toBe('coincidencia');
  });

  it('buscarPorIngredientes no debería cambiar el orden si ya había uno elegido', async () => {
    await setup();
    component['setSort']('rating');

    component['buscarPorIngredientes']();

    expect(component['sortBy']()).toBe('rating');
  });

  it('limpiarFiltroPorIngredientes debería desactivar el filtro', async () => {
    await setup();
    component['buscarPorIngredientes']();

    component['limpiarFiltroPorIngredientes']();

    expect(component['filterByIngredients']()).toBe(false);
  });

  it('deberia mostrar y cerrar el popup de ruleta de comidas', async () => {
    await setup();

    expect(component['showRoulettePopup']()).toBe(false);

    component['openRoulettePopup']();
    expect(component['showRoulettePopup']()).toBe(true);

    component['closeRoulettePopup']();
    expect(component['showRoulettePopup']()).toBe(false);
  });

  it('debería ocultar recetas sin coincidencias cuando el filtro está activo', async () => {
    await setup([mockRecetaArroz, mockRecetaPasta], [arrozPantry]);
    expect(component['filteredRecipes']()).toHaveLength(2);

    component['buscarPorIngredientes']();

    const filtered = component['filteredRecipes']();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Arroz con leche');
  });

  it('debería ordenar por mayor coincidencia cuando el filtro está activo', async () => {
    const receta100 = makeReceta('r1', 'Arroz con leche', [
      { id: 'i1', productoId: 'p1', nombre: 'Arroz', productoNombre: 'Arroz', cantidad: 200, unidad: 'g', enStock: true },
      { id: 'i2', productoId: 'p2', nombre: 'Leche', productoNombre: 'Leche', cantidad: 500, unidad: 'ml', enStock: true },
    ]);
    const receta50 = makeReceta('r2', 'Pasta con salsa', [
      { id: 'i3', productoId: 'p3', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: true },
      { id: 'i4', productoId: 'p4', nombre: 'Tomate', productoNombre: 'Tomate', cantidad: 300, unidad: 'g', enStock: false },
    ]);
    await setup([receta100, receta50], [arrozPantry, lechePantry, fideoPantry]);
    component['buscarPorIngredientes']();

    const filtered = component['filteredRecipes']();
    expect(filtered[0].availabilityPercent).toBeGreaterThanOrEqual(filtered[1].availabilityPercent);
  });

  it('deberia ocultar recetas con alergenos de quienes comen hoy', async () => {
    const recetaConGluten = makeReceta('r1', 'Pasta', [
      { id: 'i1', productoId: 'p1', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: true, alergenos: ['Gluten'] },
    ]);
    const recetaSinGluten = makeReceta('r2', 'Ensalada', [
      { id: 'i2', productoId: 'p2', nombre: 'Tomate', productoNombre: 'Tomate', cantidad: 1, unidad: 'unidad', enStock: true, alergenos: [] },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Gluten'] },
    ];

    await setup([recetaConGluten, recetaSinGluten], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']().map(recipe => recipe.name)).toEqual(['Ensalada']);
  });

  it('deberia dejar de filtrar alergias al deseleccionar el miembro que come hoy', async () => {
    const recetaConGluten = makeReceta('r1', 'Pasta', [
      { id: 'i1', productoId: 'p1', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: true, alergenos: ['Gluten'] },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Gluten'] },
    ];

    await setup([recetaConGluten], [], HOGAR_ID, miembros);
    component['toggleAllergens']();
    expect(component['filteredRecipes']()).toHaveLength(0);

    component['toggleEatingToday']('u1');

    expect(component['filteredRecipes']()).toHaveLength(1);
  });

  it('deberia ocultar recetas que requieren electrodomesticos faltantes', async () => {
    const recetaHorno = {
      ...makeReceta('r1', 'Pollo al horno', []),
      electrodomesticos: [{ id: 'e1', tipoRequerido: 'Horno/Cocina' }],
    };
    const recetaLibre = {
      ...makeReceta('r2', 'Ensalada', []),
      electrodomesticos: [],
    };
    const electrodomesticos = [
      { id: 'a1', hogarId: HOGAR_ID, nombre: 'Licuadora', tipo: 'Cocina', estado: null, imagenUrl: null, marca: null },
    ];

    await setup([recetaHorno, recetaLibre], [], HOGAR_ID, [], electrodomesticos);

    component['toggleMissingAppliances']();

    expect(component['filteredRecipes']().map(recipe => recipe.name)).toEqual(['Ensalada']);
  });

  it('deberia detectar alergenos por nombre si la API de recetas no los envia', async () => {
    const recetaConFideos = makeReceta('r1', 'Pasta', [
      { id: 'i1', productoId: 'p1', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Gluten'] },
    ];

    await setup([recetaConFideos], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']()).toHaveLength(0);
  });

  it('deberia usar alergias del perfil si miembros todavia no trae alergias', async () => {
    const recetaConFideos = makeReceta('r1', 'Pasta', [
      { id: 'i1', productoId: 'p1', nombre: 'Fideos', productoNombre: 'Fideos', cantidad: 200, unidad: 'g', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: [] },
    ];

    await setup([recetaConFideos], [], HOGAR_ID, miembros, [], ['Gluten']);

    component['toggleAllergens']();

    expect(component['filteredRecipes']()).toHaveLength(0);
  });

  it('deberia mapear restriccion Sin lactosa contra ingredientes con leche', async () => {
    const recetaConLeche = makeReceta('r1', 'Arroz con leche', [
      { id: 'i1', productoId: 'p1', nombre: 'Leche', productoNombre: 'Leche', cantidad: 500, unidad: 'ml', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Sin lactosa'] },
    ];

    await setup([recetaConLeche], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']()).toHaveLength(0);
  });

  it('deberia mapear alimentacion Sin lactosa del perfil contra ingredientes con leche', async () => {
    const recetaConLeche = makeReceta('r1', 'Arroz con leche', [
      { id: 'i1', productoId: 'p1', nombre: 'Leche', productoNombre: 'Leche', cantidad: 500, unidad: 'ml', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: [] },
    ];

    await setup([recetaConLeche], [], HOGAR_ID, miembros, [], [], ['Sin lactosa']);

    component['toggleAllergens']();

    expect(component['filteredRecipes']()).toHaveLength(0);
  });

  it('deberia mapear Vegano contra ingredientes de origen animal', async () => {
    const recetaConPollo = makeReceta('r1', 'Pollo al horno', [
      { id: 'i1', productoId: 'p1', nombre: 'Pechuga de pollo', productoNombre: 'Pechuga de pollo', cantidad: 1, unidad: 'unidad', enStock: true },
    ]);
    const recetaConHuevo = makeReceta('r2', 'Omelette', [
      { id: 'i2', productoId: 'p2', nombre: 'Huevos', productoNombre: 'Huevos', cantidad: 2, unidad: 'unidad', enStock: true },
    ]);
    const recetaVegana = makeReceta('r3', 'Ensalada de tomate', [
      { id: 'i3', productoId: 'p3', nombre: 'Tomate', productoNombre: 'Tomate', cantidad: 1, unidad: 'unidad', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Vegano'] },
    ];

    await setup([recetaConPollo, recetaConHuevo, recetaVegana], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']().map(recipe => recipe.name)).toEqual(['Ensalada de tomate']);
  });

  it('deberia mapear Vegetariano contra carne pescado y mariscos', async () => {
    const recetaConPescado = makeReceta('r1', 'Merluza al horno', [
      { id: 'i1', productoId: 'p1', nombre: 'Merluza', productoNombre: 'Merluza', cantidad: 1, unidad: 'unidad', enStock: true },
    ]);
    const recetaConQueso = makeReceta('r2', 'Tarta de queso', [
      { id: 'i2', productoId: 'p2', nombre: 'Queso', productoNombre: 'Queso', cantidad: 100, unidad: 'g', enStock: true },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Vegetariano'] },
    ];

    await setup([recetaConPescado, recetaConQueso], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']().map(recipe => recipe.name)).toEqual(['Tarta de queso']);
  });

  it('deberia combinar alergenos de la API con deteccion local por ingrediente', async () => {
    const recetaConLeche = makeReceta('r1', 'Panqueques', [
      { id: 'i1', productoId: 'p1', nombre: 'Leche', productoNombre: 'Leche', cantidad: 250, unidad: 'ml', enStock: true, alergenos: ['Gluten'] },
    ]);
    const miembros = [
      { usuarioId: 'u1', nombre: 'Marco', email: 'm@test.com', rol: 'owner', fotoUrl: null, alergias: ['Sin lactosa'] },
    ];

    await setup([recetaConLeche], [], HOGAR_ID, miembros);

    component['toggleAllergens']();

    expect(component['filteredRecipes']()).toHaveLength(0);
  });

  describe('Filtros de Dificultad', () => {
    it('deberia filtrar recetas mostrando solo Fácil', async () => {
      const recetaFacil = { ...makeReceta('r1', 'Receta Fácil', []), dificultad: 'Fácil' };
      const recetaMedia = { ...makeReceta('r2', 'Receta Media', []), dificultad: 'Media' };
      const recetaDificil = { ...makeReceta('r3', 'Receta Difícil', []), dificultad: 'Difícil' };

      await setup([recetaFacil, recetaMedia, recetaDificil], []);
      
      component['setFilter']('Fácil');
      
      const filtered = component['filteredRecipes']();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Receta Fácil');
      expect(filtered[0].difficulty).toBe('Fácil');
    });

    it('deberia filtrar recetas mostrando solo Medio', async () => {
      const recetaFacil = { ...makeReceta('r1', 'Receta Fácil', []), dificultad: 'Fácil' };
      const recetaMedia = { ...makeReceta('r2', 'Receta Media', []), dificultad: 'Media' };
      const recetaDificil = { ...makeReceta('r3', 'Receta Difícil', []), dificultad: 'Difícil' };

      await setup([recetaFacil, recetaMedia, recetaDificil], []);
      
      component['setFilter']('Medio');
      
      const filtered = component['filteredRecipes']();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Receta Media');
      expect(filtered[0].difficulty).toBe('Medio');
    });

    it('deberia filtrar recetas mostrando solo Difícil', async () => {
      const recetaFacil = { ...makeReceta('r1', 'Receta Fácil', []), dificultad: 'Fácil' };
      const recetaMedia = { ...makeReceta('r2', 'Receta Media', []), dificultad: 'Media' };
      const recetaDificil = { ...makeReceta('r3', 'Receta Difícil', []), dificultad: 'Difícil' };

      await setup([recetaFacil, recetaMedia, recetaDificil], []);
      
      component['setFilter']('Difícil');
      
      const filtered = component['filteredRecipes']();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Receta Difícil');
      expect(filtered[0].difficulty).toBe('Difícil');
    });

    it('deberia mostrar todas las recetas cuando se selecciona Todos', async () => {
      const recetaFacil = { ...makeReceta('r1', 'Receta Fácil', []), dificultad: 'Fácil' };
      const recetaMedia = { ...makeReceta('r2', 'Receta Media', []), dificultad: 'Media' };
      const recetaDificil = { ...makeReceta('r3', 'Receta Difícil', []), dificultad: 'Difícil' };

      await setup([recetaFacil, recetaMedia, recetaDificil], []);
      
      component['setFilter']('Todos');
      
      const filtered = component['filteredRecipes']();
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Ordenamiento de Recetas', () => {
    it('deberia ordenar por urgencia por defecto', async () => {
      const normal = makeReceta('r1', 'Normal', []);
      const urgente = makeReceta('r2', 'Urgente', [], {
        tieneProductosPorVencer: true,
        fechaVencimientoMasProxima: '2026-06-18',
        diasHastaVencimiento: 2,
      });

      await setup([normal, urgente], []);

      expect(component['sortBy']()).toBe('urgencia');
      expect(component['filteredRecipes']()[0].name).toBe('Urgente');
    });

    it('deberia desempatar urgentes por menor cantidad de dias hasta vencimiento', async () => {
      const venceDespues = makeReceta('r1', 'Vence despues', [], {
        tieneProductosPorVencer: true,
        fechaVencimientoMasProxima: '2026-06-21',
        diasHastaVencimiento: 5,
      });
      const venceAntes = makeReceta('r2', 'Vence antes', [], {
        tieneProductosPorVencer: true,
        fechaVencimientoMasProxima: '2026-06-17',
        diasHastaVencimiento: 1,
      });

      await setup([venceDespues, venceAntes], []);

      expect(component['filteredRecipes']().map(recipe => recipe.name)).toEqual(['Vence antes', 'Vence despues']);
    });

    it('deberia mostrar badge URGENTE en la card', async () => {
      const urgente = makeReceta('r1', 'Tarta urgente', [], {
        tieneProductosPorVencer: true,
        fechaVencimientoMasProxima: '2026-06-17',
        diasHastaVencimiento: 1,
        productosPorVencer: [
          { productoId: 'p1', nombre: 'Leche', fechaVencimiento: '2026-06-17', diasHastaVencimiento: 1 },
        ],
      });

      await setup([urgente], []);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('URGENTE');
    });

    it('deberia listar productos por vencer en el hover del badge urgente', async () => {
      const urgente = makeReceta('r1', 'Panqueques', [], {
        tieneProductosPorVencer: true,
        fechaVencimientoMasProxima: '2026-06-18',
        diasHastaVencimiento: 2,
        productosPorVencer: [
          { productoId: 'p1', nombre: 'Leche', fechaVencimiento: '2026-06-18', diasHastaVencimiento: 2 },
          { productoId: 'p2', nombre: 'Huevos', fechaVencimiento: '2026-06-19', diasHastaVencimiento: 3 },
        ],
      });

      await setup([urgente], []);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Productos por vencer');
      expect(text).toContain('Leche');
      expect(text).toContain('Vence en 2 días');
      expect(text).toContain('Huevos');
      expect(text).toContain('Vence en 3 días');
    });

    it('deberia mostrar la opcion Mayor urgencia y actualizar el sort', async () => {
      await setup([], []);

      expect(component['getSortLabel']()).toBe('Mayor urgencia');
      component['setSort']('rating');
      expect(component['getSortLabel']()).toBe('Mejor valoradas');
      component['setSort']('urgencia');
      expect(component['getSortLabel']()).toBe('Mayor urgencia');
    });

    it('deberia ordenar por Mejor valoradas (rating) de forma descendente', async () => {
      const recetaMala = makeReceta('r1', 'Mala', []);
      const recetaExcelente = makeReceta('r2', 'Excelente', []);
      const recetaRegular = makeReceta('r3', 'Regular', []);
      
      await setup([recetaMala, recetaExcelente, recetaRegular], []);
      
      const mapped = component['allRecipes']();
      mapped[0].rating = 2.0;
      mapped[1].rating = 5.0;
      mapped[2].rating = 3.5;
      
      component['allRecipes'].set([...mapped]);
      
      component['setSort']('rating');
      
      const sorted = component['filteredRecipes']();
      expect(sorted[0].name).toBe('Excelente');
      expect(sorted[1].name).toBe('Regular');
      expect(sorted[2].name).toBe('Mala');
    });

    it('deberia ordenar por Mayor coincidencia (coincidencia) de forma descendente', async () => {
      const recetaBaja = makeReceta('r1', 'Coincidencia Baja', [
        { id: 'i1', productoId: 'p1', nombre: 'Arroz', productoNombre: 'Arroz', cantidad: 100, unidad: 'g', enStock: false }
      ]);
      const recetaAlta = makeReceta('r2', 'Coincidencia Alta', [
        { id: 'i2', productoId: 'p2', nombre: 'Leche', productoNombre: 'Leche', cantidad: 100, unidad: 'ml', enStock: true }
      ]);
      const recetaMedia = makeReceta('r3', 'Coincidencia Media', [
        { id: 'i3', productoId: 'p3', nombre: 'Azúcar', productoNombre: 'Azúcar', cantidad: 100, unidad: 'g', enStock: true },
        { id: 'i4', productoId: 'p4', nombre: 'Harina', productoNombre: 'Harina', cantidad: 100, unidad: 'g', enStock: false }
      ]);
      
      await setup([recetaBaja, recetaAlta, recetaMedia], []);
      
      component['setSort']('coincidencia');
      
      const sorted = component['filteredRecipes']();
      expect(sorted[0].name).toBe('Coincidencia Alta');
      expect(sorted[1].name).toBe('Coincidencia Media');
      expect(sorted[2].name).toBe('Coincidencia Baja');
    });

    it('deberia ordenar por defecto (default) manteniendo el orden original de las recetas', async () => {
      const receta1 = makeReceta('r1', 'Receta 1', [
        { id: 'i1', productoId: 'p1', nombre: 'Arroz', productoNombre: 'Arroz', cantidad: 100, unidad: 'g', enStock: true }
      ]);
      const receta2 = makeReceta('r2', 'Receta 2', [
        { id: 'i2', productoId: 'p2', nombre: 'Leche', productoNombre: 'Leche', cantidad: 100, unidad: 'ml', enStock: false }
      ]);
      const receta3 = makeReceta('r3', 'Receta 3', [
        { id: 'i3', productoId: 'p3', nombre: 'Queso', productoNombre: 'Queso', cantidad: 100, unidad: 'g', enStock: true }
      ]);
      
      await setup([receta1, receta2, receta3], []);
      
      component['setSort']('default');
      
      const sorted = component['filteredRecipes']();
      expect(sorted[0].name).toBe('Receta 1');
      expect(sorted[1].name).toBe('Receta 2');
      expect(sorted[2].name).toBe('Receta 3');
    });
  });
});
