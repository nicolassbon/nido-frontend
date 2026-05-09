# Nido Frontend

Frontend separado de Nido (Angular 21), integrado por HTTP con `nido-backend`.

## Scripts

```bash
npm install
npm start
```

App local: `http://localhost:4200`

## Integración HTTP mínima MVP

La app consume `GET /hello` usando `environment.apiBaseUrl`.

- desarrollo: `http://localhost:8080`
- producción: `http://backend:8080`

No hardcodear URLs fuera de `src/environments/`.

## Tests

```bash
npm test
npm run test:ci
```
