import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatCard } from './stat-card';
import { appConfig } from '../../../app.config';

describe('StatCard', () => {
  let component: StatCard;
  let fixture: ComponentFixture<StatCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCard],
      providers: [
        ...appConfig.providers,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatCard);
    component = fixture.componentInstance;
    component.icon = 'trophy';
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
