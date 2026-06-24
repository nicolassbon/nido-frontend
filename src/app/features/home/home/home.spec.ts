import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Home);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should keep local category icon assets on the frontend', () => {
    const fixture = TestBed.createComponent(Home);
    const component = fixture.componentInstance as unknown as { resolveImageUrl(url: string): string };

    expect(component.resolveImageUrl('/assets/icons/categorias/lacteos.svg'))
      .toBe('/assets/icons/categorias/lacteos.svg');
  });
});
