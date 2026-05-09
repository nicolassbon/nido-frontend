# Nido Frontend — Arquitectura técnica del MVP 1

Este documento describe la base técnica definida para el primer MVP del frontend de **Nido**. El objetivo es tener una aplicación estructurada, moderna y mantenible, capaz de escalar organizadamente y conectarse mediante HTTP con el backend.

---

## 1. Alineación tecnológica

El frontend está desarrollado con **Angular 21** utilizando herramientas y convenciones modernas del framework:

- Componentes **standalone** por defecto.
- Configuración mediante `app.config.ts` y `app.routes.ts`.
- **Strict mode** habilitado para TypeScript.
- **Vitest** como test runner predeterminado.
- Aplicación de un enfoque **feature-first** para la arquitectura de carpetas.

Al igual que en el backend, todo el código (componentes, servicios, variables, tests) se escribe en **inglés**.

---

## 2. Estructura y organización por Features

El proyecto se estructura primando la cohesión funcional sobre la división por tipo de archivo, organizándose principalmente dentro de `src/app`:

```txt
nido-frontend/
├─ src/
│  ├─ app/
│  │  ├─ core/         → Cliente de API, interceptores, guards y configuración transversal.
│  │  ├─ features/     → Módulos funcionales y flujos de usuario (ej. Households).
│  │  ├─ shared/ui/    → Componentes, pipes y directivas visuales reutilizables.
│  │  └─ app.*         → Archivos raíz de la aplicación.
│  ├─ environments/    → Variables de entorno (desarrollo, producción).
│  └─ main.ts          → Punto de entrada.
├─ angular.json
├─ package.json
└─ README.md
```

### 2.1 `core`
Maneja las responsabilidades transversales de la aplicación, como la comunicación HTTP centralizada, el manejo de sesión, el manejo global de errores y configuraciones de inicialización. Es instanciado una sola vez y no incluye componentes de UI.

### 2.2 `features`
Agrupa las funcionalidades del negocio de manera aislada. Cada feature debe ser lo más independiente posible y contener sus propios servicios, rutas, modelos y componentes (container y presentacionales) relacionados a un caso de uso (por ejemplo, el registro o vista del `Household`).

### 2.3 `shared/ui`
Contiene componentes presentacionales "tontos" (dumb components) que son puramente visuales y agnósticos al negocio (botones, modales, layouts, tipografía), diseñados para reutilizarse a lo largo de toda la aplicación.

---

## 3. Integración con el Backend

El frontend no comparte código duro ni vive en el mismo repositorio que la API. Toda la comunicación está gobernada de forma explícita por contratos HTTP.

- La URL del backend se administra usando las variables de entorno de Angular (`environment.ts` / `environment.development.ts`).
- **NUNCA** se deben hardcodear URLs del backend en los servicios o componentes.
- Los modelos recibidos por HTTP se tipean utilizando interfaces en TypeScript para mantener el contrato claro desde el lado cliente.

---

## 4. Estrategia de Testing

Se prioriza proveer una base con testing desde el inicio usando **Vitest**. La lógica de componentes inteligentes (containers) y servicios críticos, como la integración con endpoints, deben estar cubiertos con pruebas automáticas.

## 5. Criterios de calidad

- Estructura **standalone components** y feature-first estricta.
- Entorno local independiente capaz de consumir un backend corriendo localmente (puerto `8080`).
- Desarrollo sobre *feature branches* y PRs hacia `main`.
