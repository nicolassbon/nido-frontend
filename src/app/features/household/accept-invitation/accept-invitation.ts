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
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly hogaresApi = inject(HogaresApiService);
  private readonly authService = inject(AuthService);

  readonly token      = signal<string | null>(null);
  readonly state      = signal<'idle' | 'loading' | 'success' | 'error' | 'invalid'>('idle');
  readonly hogarNombre = signal('');
  readonly errorMsg   = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('invalid');
      return;
    }
    this.token.set(token);
  }

  accept(): void {
    const token = this.token();
    if (!token) return;
    this.state.set('loading');
    this.hogaresApi.aceptarInvitacion(token).subscribe({
      next: (res) => {
        // Store new JWT — will be consumed by the auth service once wired up
        this.authService.setToken(res.accessToken);
        this.hogarNombre.set(res.hogarNombre);
        this.state.set('success');
        setTimeout(() => this.router.navigate(['/']), 2500);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message ?? 'La invitación no es válida o ya expiró.');
        this.state.set('error');
      },
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
