import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../../app.config';
import { Recipes } from './recipes';

describe('Recipes', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recipes],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Recipes);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
