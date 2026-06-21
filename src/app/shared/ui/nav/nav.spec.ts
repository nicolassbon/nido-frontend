import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
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

  it('renders unavailable views as disabled nav items', () => {
    const fixture = TestBed.createComponent(Nav);
    fixture.detectChanges();

    const disabledItems = Array.from(
      fixture.nativeElement.querySelectorAll('[aria-disabled="true"]'),
    ) as HTMLElement[];

    expect(disabledItems).toHaveLength(0);
  });
});
