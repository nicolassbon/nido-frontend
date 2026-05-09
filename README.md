# Nido Frontend

Angular 21 frontend for Nido MVP 1.

## Role in the architecture

- `nido-frontend` and `nido-backend` are separate repositories.
- This app integrates with the backend **only through HTTP**.
- The backend is the source of truth for endpoint and payload definitions.

## Backend contract consumption

This frontend consumes backend endpoints through `environment.apiBaseUrl`.

- Development: `src/environments/environment.development.ts`
- Production: `src/environments/environment.production.ts`

Current values:

- Development: `http://localhost:8080`
- Production: `http://backend:8080`

Do not hardcode API URLs outside `src/environments/`.

## MVP contract usage

- `GET /hello` is consumed in `src/app/app.ts`.
- `POST /household` is part of the backend-owned MVP contract.

## Feature-first structure

The app follows a feature-first Angular layout:

| Path | Responsibility |
|------|----------------|
| `src/app/core/` | Cross-cutting concerns (API client/config) |
| `src/app/features/` | Feature slices |
| `src/app/shared/ui/` | Reusable UI components |
| `src/environments/` | Environment-specific configuration |

## Local Development Setup

To work on this project locally, ensure you have the backend running first (see `nido-backend/README.md`), as this application will attempt to connect to it.

### 1. Install Dependencies
Install all required Node.js packages:

```bash
npm install
```

### 2. Run Tests
Verify the integrity of components and services running the test suite (configured with Vitest):

```bash
npm run test
```

### 3. Start the Application
Spin up the local development server:

```bash
npm start
```

The application will be available at `http://localhost:4200/`.

It is configured to reach the backend at `http://localhost:8080/` by default via the `environment.development.ts` file.
