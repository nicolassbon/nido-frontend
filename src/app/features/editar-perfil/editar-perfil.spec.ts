import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditarPerfil } from './editar-perfil';
import { PerfilApiService } from '../perfil/perfil-api.service';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../../app.config';

describe('EditarPerfil', () => {
  let component: EditarPerfil;
  let fixture: ComponentFixture<EditarPerfil>;
  let mockPerfilApi: any;

  beforeEach(async () => {
    mockPerfilApi = {
      getProfile: vi.fn().mockReturnValue(
        of({
          nombre: 'Test User',
          email: 'test@example.com',
          sexo: 'Otro',
          telefono: '12345678',
          fotoUrl: null,
        }),
      ),
      updateProfile: vi.fn().mockReturnValue(
        of({
          nombre: 'Test User Updated',
          email: 'test@example.com',
          sexo: 'Otro',
          telefono: '12345678',
          fotoUrl: null,
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EditarPerfil],
      providers: [...appConfig.providers, { provide: PerfilApiService, useValue: mockPerfilApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(EditarPerfil);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should request photo removal when saving after removing current photo', () => {
    const editor = component as any;
    editor.fotoUrl.set('https://lh3.googleusercontent.com/a/avatar');

    editor.onRemovePhoto(new MouseEvent('click'));
    editor.onSave();

    expect(mockPerfilApi.updateProfile).toHaveBeenCalledWith(
      'Test User',
      'Otro',
      '12345678',
      null,
      true,
    );
  });
});
