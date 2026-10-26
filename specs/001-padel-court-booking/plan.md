# Implementation Plan: Reserva de Canchas de Pádel

**Branch**: `spec` (feature `001-padel-court-booking`) | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-padel-court-booking/spec.md`

## Summary

Aplicación web para reservar bloques de 1 hora en 5 canchas fijas. Los usuarios se registran
e inician sesión con correo y contraseña, consultan una grilla de 24 bloques por cancha y fecha
(ventana de 7 días), reservan un bloque (máximo una reserva activa por usuario) y gestionan
"Mis Reservas" (próximas, historial, cancelación).

Enfoque técnico: SPA React + Tailwind (Vite) que consume una API REST Express sobre SQLite
(`better-sqlite3`), todo en TypeScript. La prevención de colisiones (Principio I) se garantiza
con una transacción `BEGIN IMMEDIATE` que re-valida e inserta, más un índice único parcial
`(court_id, date, start_hour) WHERE cancelled_at IS NULL` como red final. Sesiones del lado del
servidor en SQLite con cookie HttpOnly y expiración deslizante de 24 h; contraseñas con
`crypto.scrypt`; bloqueo de login por correo (5 fallos → 15 min). Todo el cálculo de tiempo
usa la hora del club (`America/Bogota`, UTC−5) con un reloj inyectable. Detalle en
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js ≥ 20 (instalado v20.17.0); navegadores
modernos (ES2022) para el frontend.

**Primary Dependencies**:
- Backend: `express` 4, `better-sqlite3`, `cookie-parser`; dev: `tsx`, `vitest`, `supertest`.
- Frontend: `react` 18, `react-dom`, `react-router-dom` 6, `tailwindcss` 4 +
  `@tailwindcss/vite`, `vite`; dev: `vitest`, `@testing-library/react`, `jsdom`.

**Storage**: SQLite, archivo `db/padel.db`; esquema y seed en `db/schema.sql` (ver
[data-model.md](./data-model.md)).

**Testing**: Vitest en ambos paquetes; Supertest para la API con BD en memoria y reloj fijo;
prueba de concurrencia de 50 peticiones simultáneas + variante multi-hilo (`worker_threads`)
sobre el mismo archivo (SC-001); React Testing Library para componentes.

**Target Platform**: Servidor Node.js (Linux) + navegador de escritorio y móvil.

**Project Type**: Aplicación web (frontend SPA + backend API REST).

**Performance Goals**: Grilla de disponibilidad < 2 s en el p95 (SC-004) — una consulta
indexada por `(court_id, date)`; objetivo interno p95 < 100 ms en la API.

**Constraints**: Cero reservas duplicadas bajo concurrencia (SC-001); zona horaria fija UTC−5;
errores siempre como mensaje amigable con códigos HTTP semánticos; sin funcionalidades fuera
del spec (FR-024).

**Scale/Scope**: Un club, 5 canchas, 24 bloques/día, ventana de 7 días (840 bloques
reservables); del orden de cientos a pocos miles de usuarios; 5 pantallas y 9 endpoints.

Sin elementos `NEEDS CLARIFICATION`: el stack lo fija la constitución y las reglas de negocio
quedaron resueltas en la sesión de clarificación del spec (2026-10-22).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Estado |
|-----------|--------------|--------|
| **I. Prevención de colisiones (NO NEGOCIABLE)** | Creación de reserva en transacción `BEGIN IMMEDIATE` que re-valida disponibilidad, pasado, ventana y reserva activa, e inserta; índice único parcial como garantía final; `SQLITE_CONSTRAINT_UNIQUE` → 409 `SLOT_TAKEN`. Probado con 50 peticiones simultáneas y multi-hilo (research R1, R11). | ✅ PASS |
| **II. Dominio cerrado y autenticación** | 5 canchas sembradas en `schema.sql`; ningún endpoint ni código escribe en `courts`. Formato 24 h. Grilla, crear, "Mis Reservas" y cancelar exigen sesión → 401 `UNAUTHENTICATED`. La lista de canchas es pública (Assumption del spec: no expone disponibilidad). | ✅ PASS |
| **III. Simplicidad y estructura plana** | Raíz con `/frontend`, `/backend`, `/db`. Sin ORM (`better-sqlite3` + SQL). Sin capas repositorio/servicio: cada archivo de rutas contiene sus consultas SQL; solo se extraen funciones puras reutilizadas (`clubTime`, `validation`, `password`, `session`). Sin librerías de esquemas, estado global ni tiempo real. | ✅ PASS |
| **IV. TypeScript y estilo funcional** | TS en frontend y backend (`strict: true`). Funciones puras y componentes funcionales con Hooks; sin clases (el error HTTP se modela como objeto `{ status, code }`, no como subclase de `Error`). `camelCase` funciones/variables, `PascalCase` tipos/componentes. | ✅ PASS |
| **V. Errores amigables y HTTP semántico** | Respuesta de error uniforme `{ error: { code, message } }`; 400/401/409 como exige la constitución, más 404 (reserva inexistente/ajena, FR-021) y 429 (bloqueo de login, FR-023) — amplían la semántica sin contradecirla. Handler final convierte cualquier excepción en 500 genérico sin stack. El frontend traduce por `code` desde un catálogo en español (research R7). | ✅ PASS |
| **VI. Cero código sombra** | Cada endpoint y pantalla traza a FR/US (ver [contracts/](./contracts/)). Excluidos explícitamente: pagos, admin, notificaciones, reservas multi-bloque, matchmaking, recuperación de contraseña, verificación de correo, tiempo real. | ✅ PASS |

**Resultado pre-diseño**: PASS, sin violaciones. **Re-evaluación post-diseño (Phase 1)**: PASS —
el modelo de datos, el contrato OpenAPI y las rutas UI no introducen entidades, endpoints ni
abstracciones fuera de lo listado; Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/001-padel-court-booking/
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/
│   ├── openapi.yaml     # Contrato REST (Phase 1)
│   └── ui-routes.md     # Contrato de pantallas/rutas (Phase 1)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NO creado por /speckit-plan)
```

### Source Code (repository root)

```text
package.json                 # npm workspaces: frontend, backend; scripts dev/test/db:reset
.gitignore                   # node_modules, dist, db/padel.db*

db/
├── schema.sql               # Tablas, índices y seed idempotente de las 5 canchas
└── padel.db                 # Generado en runtime (git-ignorado)

backend/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts            # Arranque: abre BD, aplica schema, escucha :3000
│   ├── app.ts               # createApp({ db, now }): middlewares, rutas, error handler
│   ├── db.ts                # openDb(path): better-sqlite3 + pragmas + schema.sql
│   ├── routes/
│   │   ├── auth.ts          # register, login, logout, me
│   │   ├── courts.ts        # listado y disponibilidad
│   │   └── reservations.ts  # crear (transacción IMMEDIATE), mis reservas, cancelar
│   └── lib/
│       ├── clubTime.ts      # Puras: clubToday, bookingWindow, slotStartMs, slotLabel
│       ├── validation.ts    # Puras: parseEmail, parsePassword, parseDate, parseStartHour, parseCourtId
│       ├── password.ts      # hashPassword / verifyPassword (scrypt)
│       ├── session.ts       # createSession, requireSession (expiración deslizante 24 h)
│       ├── loginLimiter.ts  # Reglas FR-003a sobre login_attempts
│       └── httpError.ts     # httpError(status, code), mensajes en español, errorHandler
└── tests/
    ├── clubTime.test.ts
    ├── validation.test.ts
    ├── auth.test.ts         # US1 + lockout + expiración de sesión
    ├── courts.test.ts       # Lista, grilla y 3 estados
    ├── reservations.test.ts # US2 + US3
    └── concurrency.test.ts  # SC-001

frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts           # React + Tailwind; proxy /api → http://localhost:3000
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Rutas (ver contracts/ui-routes.md) + ProtectedRoute
│   ├── index.css            # @import "tailwindcss"
│   ├── api/client.ts        # fetch tipado; normaliza errores a { code }
│   ├── auth/AuthContext.tsx # Usuario actual, login/logout/register
│   ├── lib/
│   │   ├── errorMessages.ts # code → mensaje en español
│   │   └── types.ts         # Tipos espejo del contrato OpenAPI
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── CourtsPage.tsx
│   │   ├── CourtAvailabilityPage.tsx
│   │   └── MyReservationsPage.tsx
│   └── components/
│       ├── DayPicker.tsx
│       ├── SlotGrid.tsx
│       ├── ConfirmDialog.tsx
│       └── ErrorBanner.tsx
└── tests/
    ├── SlotGrid.test.tsx
    ├── DayPicker.test.tsx
    └── errorMessages.test.ts
```

**Structure Decision**: Aplicación web con la estructura plana exigida por el Principio III:
`/frontend` (SPA Vite + React), `/backend` (Express) y `/db` (esquema SQLite y archivo de datos).
Dentro del backend, `routes/` agrupa los handlers por recurso con su SQL inline y `lib/` solo
contiene funciones puras/utilidades compartidas; no hay capas de servicio ni repositorio.
En desarrollo, Vite hace proxy de `/api` al backend para compartir origen (cookies sin CORS).

## Complexity Tracking

> Sin violaciones de la constitución; no se requiere justificación.
