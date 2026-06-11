import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';
import { appConfig } from '../../../app.config';

describe('Avatar', () => {
  let component: Avatar;
  let fixture: ComponentFixture<Avatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Avatar],
      providers: [
        ...appConfig.providers,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Avatar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display image when fotoUrl is provided', async () => {
    fixture.componentRef.setInput('fotoUrl', 'https://example.com/photo.jpg');
    fixture.componentRef.setInput('nombre', 'Nicolas Bon');
    fixture.detectChanges();
    await fixture.whenStable();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('https://example.com/photo.jpg');

    const initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv).toBeFalsy();
  });

  it('should display initials when fotoUrl is null', async () => {
    fixture.componentRef.setInput('fotoUrl', null);
    fixture.componentRef.setInput('nombre', 'Nicolas Bon');
    fixture.detectChanges();
    await fixture.whenStable();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeFalsy();

    const initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv).toBeTruthy();
    expect(initialsDiv.textContent.trim()).toBe('NB');
  });

  it('should extract initials correctly', async () => {
    fixture.componentRef.setInput('nombre', 'Nico');
    fixture.detectChanges();
    await fixture.whenStable();
    let initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv.textContent.trim()).toBe('N');

    fixture.componentRef.setInput('nombre', 'Nicolas Bon');
    fixture.detectChanges();
    await fixture.whenStable();
    initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv.textContent.trim()).toBe('NB');

    fixture.componentRef.setInput('nombre', 'María de la Paz');
    fixture.detectChanges();
    await fixture.whenStable();
    initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv.textContent.trim()).toBe('MP');

    fixture.componentRef.setInput('nombre', '');
    fixture.detectChanges();
    await fixture.whenStable();
    initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv.textContent.trim()).toBe('?');
  });

  it('should fall back to initials on image loading error', async () => {
    fixture.componentRef.setInput('fotoUrl', 'https://example.com/invalid-photo.jpg');
    fixture.componentRef.setInput('nombre', 'Nicolas Bon');
    fixture.detectChanges();
    await fixture.whenStable();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();

    const initialsDiv = fixture.nativeElement.querySelector('div');
    expect(initialsDiv).toBeTruthy();
    expect(initialsDiv.textContent.trim()).toBe('NB');

    const imgAfterError = fixture.nativeElement.querySelector('img');
    expect(imgAfterError).toBeFalsy();
  });
});
