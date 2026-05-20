import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { appConfig } from '../../../../app.config';
import { Alacena } from './alacena';

describe('Alacena', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alacena],
      providers: [...appConfig.providers, provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Alacena);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
