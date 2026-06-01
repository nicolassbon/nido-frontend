import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { HogaresApiService } from '../hogares-api.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-accept-invitation',
  imports: [LucideAngularModule],
  templateUrl: './accept-invitation.html',
})
export class AcceptInvitation implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly hogaresApi  = inject(HogaresApiService);
  private readonly authService = inject(AuthService);

  readonly token       = signal<string | null>(null);
  readonly state       = signal<'preview-loading' | 'idle' | 'unauthenticated' | 'loading' | 'success' | 'error' | 'invalid'>('preview-loading');
  readonly hogarNombre = signal('');
  readonly errorMsg    = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.token.set(token);

    this.hogaresApi.getInvitacionPreview(token).subscribe({
      next: (preview) => {
        this.hogarNombre.set(preview.hogarNombre);
        this.state.set(this.authService.isAuthenticated() ? 'idle' : 'unauthenticated');
      },
      error: (err) => {
        if (err.status === 404 || err.status === 409 || err.status === 410) {
          this.state.set('invalid');
        } else {
          this.errorMsg.set('Ocurrió un error al verificar la invitación.');
          this.state.set('error');
        }
      },
    });
  }

  accept(): void {
    const token = this.token();
    if (!token) return;
    this.state.set('loading');
    this.hogaresApi.aceptarInvitacion(token).subscribe({
      next: (res) => {
        this.authService.setToken(res.accessToken);
        this.hogarNombre.set(res.hogarNombre);
        this.state.set('success');
        setTimeout(() => this.router.navigate(['/inicio']), 2500);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.detail ?? 'La invitación no es válida o ya expiró.');
        this.state.set('error');
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: `/invitacion?token=${this.token()}` } });
  }

  goToRegister(): void {
    this.router.navigate(['/registro'], { queryParams: { returnUrl: `/invitacion?token=${this.token()}` } });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
