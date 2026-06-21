import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilComponent } from './perfil';
import { PerfilApiService } from './perfil-api.service';
import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import { HogaresApiService } from '../household/hogares-api.service';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';

describe('PerfilComponent', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let mockPerfilApi: any;
  let mockOnboardingApi: any;
  let mockHogaresApi: any;

  beforeEach(async () => {
    mockPerfilApi = {
      getProfile: vi.fn().mockReturnValue(of({
        nombre: 'Test User',
        email: 'test@example.com',
        sexo: 'Otro',
        telefono: '12345678',
        fotoUrl: null,
      })),
    };

    mockOnboardingApi = {
      getPreferenciasAlimentarias: vi.fn().mockReturnValue(of([])),
      getAlergias: vi.fn().mockReturnValue(of([])),
    };

    mockHogaresApi = {
      getHogar: vi.fn().mockReturnValue(of({ id: 'h-1', nombre: 'Mi hogar' })),
    };

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        ...appConfig.providers,
        { provide: PerfilApiService, useValue: mockPerfilApi },
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
        { provide: HogaresApiService, useValue: mockHogaresApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
