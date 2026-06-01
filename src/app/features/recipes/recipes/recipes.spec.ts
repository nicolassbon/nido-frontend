import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Recipes } from './recipes';
import { RecipesApiService, ApiReceta } from './services/recipes-api.service';
import { ProductService, ProductManualResponse } from '../../../core/servicios/agregar-producto.service';
import { AuthService } from '../../../core/auth/auth.service';

// ─── Mocks de datos ──────────────────────────────────────────────────────────

const HOGAR_ID = 'test-hogar-id';

const makeReceta = (
  id: string,
  nombre: string,
  ingredientes: ApiReceta['ingredientes'],
): ApiReceta => ({
  id, nombre, ingredientes,
  descripcion: null, tiempoCoccionMin: 30, dificultad: 'Fácil', porciones: 2,
  fuenteId: null, imagenUrl: null, calorias: 200,
  proteinas: null, carbohidratos: null, grasas: null,
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
  estaAbierto: false, porcentajeConsumido: 0,
});

const arrozPantry = makePantry('s1', 'p1', 'Arroz');
const lechePantry = makePantry('s2', 'p2', 'Leche');
const fideoPantry = makePantry('s3', 'p3', 'Fideos');

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Recipes', () => {
  let fixture:   ComponentFixture<Recipes>;
  let component: Recipes;

  const recipesApiMock  = { getAll:           vi.fn() };
  const productSvcMock  = { getProductManual: vi.fn(), createStockHome: vi.fn() };
  const authServiceMock = { getHogarId:       vi.fn() };

  /**
   * Configura el módulo, crea el componente e invoca ngOnInit directamente
   * (sin fixture.detectChanges) para evitar errores de rendering del template.
   */
  async function setup(
    recetas: ApiReceta[]             = [],
    pantry:  ProductManualResponse[] = [],
    hogarId: string | null           = HOGAR_ID,
  ): Promise<void> {
    recipesApiMock.getAll.mockReturnValue(of(recetas));
    productSvcMock.getProductManual.mockReturnValue(of(pantry));
    authServiceMock.getHogarId.mockReturnValue(hogarId);

    await TestBed.configureTestingModule({
      imports:   [Recipes],
      schemas:   [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        { provide: RecipesApiService, useValue: recipesApiMock  },
        { provide: ProductService,    useValue: productSvcMock  },
        { provide: AuthService,       useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(Recipes);
    component = fixture.componentInstance;

    // Llamamos ngOnInit directamente para evitar renderizar el template
    // (que requiere providers de íconos de Lucide no disponibles en tests)
    component.ngOnInit();
  }

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  // ─── Creación ──────────────────────────────────────────────────────────────

  it('debería crearse correctamente', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  // ─── Carga de la alacena ───────────────────────────────────────────────────

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
    expect(pantry[0].amount).toBe('100');
    expect(pantry[0].selected).toBe(true);
  });

  it('debería dejar pantryIngredients vacío si la alacena no tiene productos', async () => {
    await setup([], []);
    expect(component['pantryIngredients']()).toHaveLength(0);
  });

  // ─── Cálculo de disponibilidad (pantry seleccionada + fallback a inStock) ────

  it('debería calcular 50% cuando la pantry tiene Arroz seleccionado (1 de 2 ingredientes)', async () => {
    // Arroz en pantry → matchea por nombre con ingrediente Arroz → 1/2 = 50%
    await setup([mockRecetaArroz], [arrozPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);
  });

  it('debería calcular 0% cuando la pantry tiene Fideos pero la receta pide Arroz y Leche', async () => {
    await setup([mockRecetaArroz], [fideoPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  it('debería calcular 0% cuando ningún ingrediente matchea por nombre', async () => {
    await setup([mockRecetaPasta], [arrozPantry]); // Arroz no está en Pasta con salsa
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  it('debería usar inStock del backend cuando la alacena está vacía', async () => {
    // Sin pantry: usa inStock. mockRecetaArroz tiene Arroz inStock:true → 1/2 = 50%
    await setup([mockRecetaArroz], []);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);
  });

  it('debería matchear ingredientes con nombres parciales (fuzzy)', async () => {
    const arrozIntegral = makePantry('sx', 'px', 'Arroz integral');
    await setup([mockRecetaArroz], [arrozIntegral]);
    // "arroz integral" contiene "arroz" → debe matchear con el ingrediente "Arroz"
    expect(component['filteredRecipes']()[0].availabilityPercent).toBeGreaterThan(0);
  });

  it('debería calcular 0% cuando todos los ingredientes de la pantry están deseleccionados', async () => {
    await setup([mockRecetaArroz], [arrozPantry]);
    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(50);

    component['toggleIngredient'](0); // deselecciona Arroz → pantry tiene items pero nada seleccionado → 0%

    expect(component['filteredRecipes']()[0].availabilityPercent).toBe(0);
  });

  // ─── Filtro por ingredientes ───────────────────────────────────────────────

  it('buscarPorIngredientes debería activar el filtro', async () => {
    await setup();
    expect(component['filterByIngredients']()).toBe(false);

    component['buscarPorIngredientes']();

    expect(component['filterByIngredients']()).toBe(true);
  });

  it('buscarPorIngredientes debería cambiar el orden a coincidencia si era default', async () => {
    await setup();
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

  it('debería ocultar recetas sin coincidencias cuando el filtro está activo', async () => {
    // Arroz con leche: Arroz inStock+seleccionado → 50%. Pasta: 0%
    await setup([mockRecetaArroz, mockRecetaPasta], [arrozPantry]);
    expect(component['filteredRecipes']()).toHaveLength(2);

    component['buscarPorIngredientes']();

    const filtered = component['filteredRecipes']();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Arroz con leche');
  });

  it('debería ordenar por mayor coincidencia cuando el filtro está activo', async () => {
    // Arroz con leche: Arroz inStock+seleccionado (50%). Pasta: Fideos inStock+seleccionado (50% si agregamos)
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
});
