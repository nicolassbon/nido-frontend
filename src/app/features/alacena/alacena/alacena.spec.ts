import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Alacena } from './alacena';

describe('Alacena', () => {
  let component: Alacena;
  let fixture: ComponentFixture<Alacena>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Alacena],
    }).compileComponents();

    fixture = TestBed.createComponent(Alacena);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
