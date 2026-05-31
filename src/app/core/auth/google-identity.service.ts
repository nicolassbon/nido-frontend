import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleButtonConfiguration = {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'continue_with';
  shape: 'pill';
  width: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }): void;
          renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
          prompt(): void;
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly document = inject(DOCUMENT);

  private scriptLoadingPromise: Promise<void> | null = null;
  private credentialHandler: ((idToken: string) => void) | null = null;
  private initialized = false;
  private ready = false;

  async renderButton(host: HTMLElement, onCredential: (idToken: string) => void): Promise<void> {
    const clientId = environment.googleClientId.trim();

    if (!clientId) {
      throw new Error('Google Client ID is not configured in the frontend environment.');
    }

    await this.loadScript();

    const googleAccountsId = window.google?.accounts.id;
    if (!googleAccountsId) {
      throw new Error('Google Identity Services did not load correctly.');
    }

    this.credentialHandler = onCredential;

    if (!this.initialized) {
      googleAccountsId.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (credential) {
            this.credentialHandler?.(credential);
          }
        },
      });
      this.initialized = true;
    }

    this.ready = true;
    host.textContent = '';
    googleAccountsId.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: Math.max(Math.round(host.getBoundingClientRect().width), 240),
    });
  }

  prompt(): void {
    if (!this.ready) {
      throw new Error('Google Identity Services is not ready.');
    }

    window.google?.accounts.id.prompt();
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts.id) {
      return Promise.resolve();
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise<void>((resolve, reject) => {
      const existingScript = this.document.getElementById(
        'google-identity-script',
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Identity Services.')),
          { once: true },
        );
        return;
      }

      const script = this.document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));

      this.document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }
}
