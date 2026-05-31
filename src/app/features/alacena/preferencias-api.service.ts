import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserPreferencesResponse {
  diasAlerta: number;
}

@Injectable({ providedIn: 'root' })
export class PreferenciasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getPreferences(): Observable<UserPreferencesResponse> {
    return this.http.get<UserPreferencesResponse>(`${this.base}/api/preferencias/usuario`);
  }

  updatePreferences(diasAlerta: number): Observable<UserPreferencesResponse> {
    return this.http.patch<UserPreferencesResponse>(
      `${this.base}/api/preferencias/usuario`,
      { diasAlerta },
    );
  }
}
