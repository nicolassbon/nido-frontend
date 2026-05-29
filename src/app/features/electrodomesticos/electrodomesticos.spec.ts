import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Electrodomesticos } from './electrodomesticos';

describe('Electrodomesticos', () => {
  let component: Electrodomesticos;
  let fixture: ComponentFixture<Electrodomesticos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Electrodomesticos],
    }).compileComponents();

    fixture = TestBed.createComponent(Electrodomesticos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
