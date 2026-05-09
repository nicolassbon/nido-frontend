import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { App } from './app';
import { environment } from '../environments/environment';

describe('App', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();

    const controller = TestBed.inject(HttpTestingController);
    controller.expectOne(`${environment.apiBaseUrl}/hello`).flush({ message: '' });
    controller.verify();
  });

  it('should show loading state initially', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="loading"]')).toBeTruthy();
  });

  it('should show the hello message on success', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const controller = TestBed.inject(HttpTestingController);
    const req = controller.expectOne(`${environment.apiBaseUrl}/hello`);
    req.flush({ message: 'Bienvenido a Nido!' });

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="message"]')?.textContent).toContain(
      'Bienvenido a Nido!'
    );
    controller.verify();
  });

  it('should show error message on failure', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const controller = TestBed.inject(HttpTestingController);
    const req = controller.expectOne(`${environment.apiBaseUrl}/hello`);
    req.flush('Network error', { status: 0, statusText: 'Unknown Error' });

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error"]')).toBeTruthy();
    controller.verify();
  });
});
