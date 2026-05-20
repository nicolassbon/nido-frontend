import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../../app.config';
import { Nav } from './nav';

describe('Nav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Nav],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Nav);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
