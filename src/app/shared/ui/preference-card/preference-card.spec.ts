import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreferenceCard } from './preference-card';

describe('PreferenceCard', () => {
  let component: PreferenceCard;
  let fixture: ComponentFixture<PreferenceCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreferenceCard],
    }).compileComponents();

    fixture = TestBed.createComponent(PreferenceCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
