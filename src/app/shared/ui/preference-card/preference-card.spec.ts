import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreferenceCard } from './preference-card';
import { appConfig } from '../../../app.config';

describe('PreferenceCard', () => {
  let component: PreferenceCard;
  let fixture: ComponentFixture<PreferenceCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreferenceCard],
      providers: [
        ...appConfig.providers,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PreferenceCard);
    component = fixture.componentInstance;
    component.icon = 'ban';
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
