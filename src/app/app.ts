import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

interface HelloResponse {
  message: string;
}

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(true);
  protected readonly message = signal('');
  protected readonly error = signal('');

  constructor() {
    this.http.get<HelloResponse>(`${environment.apiBaseUrl}/hello`).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to connect to the server');
        this.loading.set(false);
      },
    });
  }
}
