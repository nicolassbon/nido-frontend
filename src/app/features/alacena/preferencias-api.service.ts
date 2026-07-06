import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ThemeMode } from '../../core/theme/theme.service';

export interface UserPreferencesResponse {
  diasAlerta: number;
  temaPreferido: ThemeMode;
}

export interface UpdateUserPreferencesRequest {
  diasAlerta?: number;
  temaPreferido?: ThemeMode;
}

@Injectable({ providedIn: 'root' })
export class PreferenciasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getPreferences(): Observable<UserPreferencesResponse> {
    return this.http.get<UserPreferencesResponse>(`${this.base}/preferencias/usuario`);
  }

  updatePreferences(diasAlerta: number): Observable<UserPreferencesResponse> {
    return this.http.patch<UserPreferencesResponse>(
      `${this.base}/preferencias/usuario`,
      { diasAlerta },
    );
  }

  updateUserPreferences(request: UpdateUserPreferencesRequest): Observable<UserPreferencesResponse> {
    return this.http.patch<UserPreferencesResponse>(
      `${this.base}/preferencias/usuario`,
      request,
    );
  }

  updateTheme(temaPreferido: ThemeMode): Observable<UserPreferencesResponse> {
    return this.updateUserPreferences({ temaPreferido });
  }
}
