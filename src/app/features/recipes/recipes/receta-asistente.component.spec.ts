import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LUCIDE_ICONS, LucideIconProvider, ChefHat, SendHorizontal, Sparkles, Trash2 } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { RecetaAsistenteComponent } from './receta-asistente.component';

describe('RecetaAsistenteComponent', () => {
  let fixture: ComponentFixture<RecetaAsistenteComponent>;
  let component: RecetaAsistenteComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecetaAsistenteComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            ChefHat,
            SendHorizontal,
            Sparkles,
            Trash2,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecetaAsistenteComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('deberia enviar pregunta, contexto e historial y agregar la respuesta de IA', () => {
    fixture.componentRef.setInput('recetaContexto', {
      id: 'r1',
      nombre: 'Tarta de pollo',
      ingredientes: ['Pollo', 'Masa', 'Cebolla'],
      faltantes: ['Pollo'],
    });
    fixture.componentRef.setInput('alacena', ['Choclo', 'Huevos']);
    component.historial.set([{ role: 'model', text: 'Hola' }]);
    component.userInput.set('Quiero ajustar esta receta');

    component.enviarMensaje();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/recetas/ia/asistente`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pregunta: 'Quiero ajustar esta receta',
      receta: {
        id: 'r1',
        nombre: 'Tarta de pollo',
        ingredientes: ['Pollo', 'Masa', 'Cebolla'],
        faltantes: ['Pollo'],
      },
      alacena: ['Choclo', 'Huevos'],
      historial: [{ role: 'model', text: 'Hola' }],
    });

    req.flush({ respuesta: 'Podés usar choclo salteado o huevo duro picado.' });

    expect(component.loading()).toBe(false);
    expect(component.historial()).toEqual([
      { role: 'model', text: 'Hola' },
      { role: 'user', text: 'Quiero ajustar esta receta' },
      { role: 'model', text: 'Podés usar choclo salteado o huevo duro picado.' },
    ]);
  });

  it('deberia enviar receta null en modo general', () => {
    component.userInput.set('Quiero una comida liviana');

    component.enviarMensaje();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/recetas/ia/asistente`);
    expect(req.request.body.receta).toBeNull();
    expect(req.request.body.alacena).toEqual([]);

    req.flush({ respuesta: 'Probá tostadas con hummus y huevo.' });
  });

  it('deberia mostrar mensaje amable si falla el endpoint', () => {
    component.userInput.set('Dame una idea');

    component.enviarMensaje();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/recetas/ia/asistente`);
    req.flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.loading()).toBe(false);
    expect(component.historial().at(-1)?.role).toBe('model');
    expect(component.historial().at(-1)?.text).toContain('No me pude conectar');
  });
});
