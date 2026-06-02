import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilComponent } from './perfil';
import { PerfilApiService } from './perfil-api.service';
import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { appConfig } from '../../app.config';

describe('PerfilComponent', () => {
  let component: PerfilComponent;
  let fixture: ComponentFixture<PerfilComponent>;
  let mockPerfilApi: any;
  let mockOnboardingApi: any;

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

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        ...appConfig.providers,
        { provide: PerfilApiService, useValue: mockPerfilApi },
        { provide: OnboardingApiService, useValue: mockOnboardingApi },
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
