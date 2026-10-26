---

description: "Lista de tareas para implementar la feature 001-padel-court-booking"
---

# Tasks: Reserva de Canchas de Pádel

**Input**: Documentos de diseño en `specs/001-padel-court-booking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, contracts/ui-routes.md, quickstart.md

**Tests**: Incluidos. El plan (Technical Context, Project Structure) y research R11 definen archivos de prueba concretos, y SC-001 / Principio I exigen una prueba de concurrencia automatizada. Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web con estructura plana (Principio III): `db/`, `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`.

## Reglas transversales (aplican a TODAS las tareas)

- TypeScript `strict: true`; sin clases (Principio IV); `camelCase` funciones/variables, `PascalCase` tipos/componentes.
- Sin ORM, sin capas servicio/repositorio: el SQL vive inline en `backend/src/routes/*.ts` (Principio III).
- Todo error de la API: `{ "error": { "code": "<CODE>", "message": "<español amigable>" } }` (research R7).
- Todo cálculo de tiempo usa `America/Bogota` (UTC−5 fijo) y el reloj inyectado `now: () => number` (research R3); nunca `Date.now()` directo en rutas.
- No añadir nada fuera del spec (FR-024, Principio VI): sin pagos, admin, notificaciones, multi-bloque, matchmaking, recuperación de contraseña, verificación de correo ni tiempo real.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del monorepo y de ambos paquetes

- [ ] T001 Crear `package.json` raíz con npm workspaces `["frontend", "backend"]`, `"private": true`, `engines.node >= 20` y scripts: `dev` (levanta backend y frontend en paralelo, p. ej. `npm run dev -w backend & npm run dev -w frontend`), `test` (`npm test -w backend && npm test -w frontend`), `db:reset` (`npm run db:reset -w backend`) en `package.json`
- [ ] T002 [P] Crear `.gitignore` raíz con `node_modules/`, `dist/`, `db/padel.db`, `db/padel.db-wal`, `db/padel.db-shm`, `*.log` en `.gitignore`
- [ ] T003 [P] Inicializar paquete backend: dependencias `express@4`, `better-sqlite3`, `cookie-parser`; devDependencies `typescript@5`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/better-sqlite3`, `@types/cookie-parser`, `@types/supertest`, `@types/node`; scripts `dev` (`tsx watch src/server.ts`), `start` (`tsx src/server.ts`), `test` (`vitest run`), `db:reset` (borra `../db/padel.db*` y aplica `../db/schema.sql`) en `backend/package.json`
- [ ] T004 [P] Crear `backend/tsconfig.json` con `strict: true`, `target: ES2022`, `module/moduleResolution: NodeNext`, `esModuleInterop: true`, `include: ["src", "tests"]` en `backend/tsconfig.json`
- [ ] T005 [P] Inicializar paquete frontend: dependencias `react@18`, `react-dom@18`, `react-router-dom@6`; devDependencies `vite`, `@vitejs/plugin-react`, `tailwindcss@4`, `@tailwindcss/vite`, `typescript@5`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom`; scripts `dev` (`vite`), `build` (`tsc -b && vite build`), `test` (`vitest run`) en `frontend/package.json`
- [ ] T006 [P] Crear `frontend/tsconfig.json` (`strict: true`, `jsx: react-jsx`, `target: ES2022`, `moduleResolution: bundler`, `include: ["src", "tests"]`) en `frontend/tsconfig.json`
- [ ] T007 [P] Crear `frontend/vite.config.ts` con plugins `react()` y `tailwindcss()`, `server.port: 5173`, `server.proxy: { '/api': 'http://localhost:3000' }`, y bloque `test: { environment: 'jsdom', globals: true }` en `frontend/vite.config.ts`
- [ ] T008 [P] Crear `frontend/index.html` (lang `es`, `<div id="root">`, script `/src/main.tsx`) y `frontend/src/index.css` con `@import "tailwindcss";` en `frontend/index.html` y `frontend/src/index.css`
- [ ] T009 Ejecutar `npm install` en la raíz y verificar que `better-sqlite3` compila/carga (`node -e "require('better-sqlite3')"` desde `backend/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, conexión a BD, contrato de errores, utilidades puras de tiempo/validación, sesiones y cliente HTTP. Bloquea todas las historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

### Base de datos

- [ ] T010 Crear `db/schema.sql` con `CREATE TABLE IF NOT EXISTS` para las 5 tablas de data-model.md:
  - `users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL)`
  - `sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)` + `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`
  - `login_attempts(email TEXT PRIMARY KEY, failed_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NULL)`
  - `courts(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)`
  - `reservations(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), court_id INTEGER NOT NULL REFERENCES courts(id), date TEXT NOT NULL, start_hour INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23), start_at INTEGER NOT NULL, end_at INTEGER NOT NULL, created_at INTEGER NOT NULL, cancelled_at INTEGER NULL)`
  - `CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_slot ON reservations(court_id, date, start_hour) WHERE cancelled_at IS NULL`
  - `CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id, cancelled_at, end_at)`
  - Seed idempotente `INSERT OR IGNORE INTO courts(id, name) VALUES (1,'Cancha Laureles'),(2,'Cancha El Poblado'),(3,'Cancha Belén'),(4,'Cancha Robledo'),(5,'Cancha Envigado')` en `db/schema.sql`
- [ ] T011 Implementar `openDb(path: string): Database` que abre `better-sqlite3`, ejecuta `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;` (WAL omitido si `path === ':memory:'`), lee `db/schema.sql` (ruta resuelta relativa al archivo, no al cwd) y lo aplica con `db.exec`; exportar también `SCHEMA_PATH` en `backend/src/db.ts`
- [ ] T012 Implementar el script `db:reset` como `backend/src/resetDb.ts` (borra `db/padel.db`, `-wal`, `-shm` si existen y llama `openDb`) y apuntar el script `db:reset` de `backend/package.json` a `tsx src/resetDb.ts` en `backend/src/resetDb.ts`

### Errores HTTP (research R7, Principio V)

- [ ] T013 [P] Implementar en `backend/src/lib/httpError.ts`: tipo `ErrorCode` (unión exacta: `INVALID_INPUT | OUT_OF_BOOKING_WINDOW | SLOT_IN_PAST | RESERVATION_NOT_CANCELLABLE | UNAUTHENTICATED | INVALID_CREDENTIALS | RESERVATION_NOT_FOUND | EMAIL_TAKEN | SLOT_TAKEN | ACTIVE_RESERVATION_EXISTS | TOO_MANY_ATTEMPTS | INTERNAL`); tipo `HttpError = { status: number; code: ErrorCode; headers?: Record<string,string> }` (objeto plano, NO subclase de `Error`); función `httpError(status, code, headers?)`; catálogo `messages: Record<ErrorCode, string>` en español (incluye `SLOT_TAKEN: 'La cancha ya fue reservada en este horario.'`, `ACTIVE_RESERVATION_EXISTS: 'Ya tienes una reserva activa. Solo se permite una a la vez.'`, `INVALID_CREDENTIALS` genérico "Correo o contraseña incorrectos.", `INTERNAL: 'Ocurrió un problema. Inténtalo de nuevo.'`); `isHttpError(x)`; middleware `errorHandler(err, req, res, next)` que responde `{ error: { code, message } }` con el status y headers del HttpError, traduce errores de `express.json` (cuerpo inválido) a 400 `INVALID_INPUT`, y cualquier otra excepción a 500 `INTERNAL` registrando el detalle solo con `console.error` (nunca stack en la respuesta)

### Tiempo del club (research R3)

- [ ] T014 [P] Implementar funciones puras en `backend/src/lib/clubTime.ts` con offset fijo `CLUB_OFFSET_MS = -5 * 3600000` y `HOUR_MS = 3600000`: `clubToday(nowMs): string` (`YYYY-MM-DD` en UTC−5), `addDays(date, n): string`, `bookingWindow(nowMs): { from: string; to: string }` (hoy … hoy+6 inclusive), `isInBookingWindow(date, nowMs): boolean`, `slotStartMs(date, hour): number` (epoch ms UTC de `date hour:00` en UTC−5), `slotEndMs(date, hour) = slotStartMs + HOUR_MS` (23:00 termina a las 00:00 del día siguiente), `isSlotStarted(date, hour, nowMs): boolean` (`slotStartMs <= now`), `slotLabel(hour): string` (`"18:00–19:00"`, `"23:00–24:00"`, con guion en `–` U+2013, dos dígitos)
- [ ] T015 [P] Escribir pruebas unitarias de clubTime en `backend/tests/clubTime.test.ts`: `clubToday` en el cambio de día (p. ej. `2026-10-27T04:59Z` → `2026-10-26`, `05:00Z` → `2026-10-27`), ventana de 7 días incluyendo cruce de mes, `slotStartMs('2026-10-27', 0) === Date.UTC(2026,9,27,5)`, `slotEndMs` del bloque 23, `isSlotStarted` en el instante exacto de inicio (true) y 1 ms antes (false), `slotLabel(0)`, `slotLabel(9)`, `slotLabel(23)`

### Validación (research R8)

- [ ] T016 [P] Implementar funciones puras en `backend/src/lib/validation.ts` que retornan `{ ok: true; value: T } | { ok: false; code: 'INVALID_INPUT' }`: `parseEmail(x)` (string, trim + minúsculas, `≤ 254 caracteres`, formato `local@dominio.tld` vía regex simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`), `parsePassword(x)` (string con `≥ 8 caracteres`; sin trim), `parseDate(x)` (string `^\d{4}-\d{2}-\d{2}$` y fecha calendario real — rechaza `2026-13-40`, `2026-02-30`), `parseStartHour(x)` (entero de tipo number `0–23`; rechaza `24`, `1.5`, `"18"`), `parseCourtId(x)` (entero `1–5`; acepta number o string numérico de path param), `parsePositiveId(x)` (entero ≥ 1 desde string de path param)
- [ ] T017 [P] Escribir pruebas unitarias de validación en `backend/tests/validation.test.ts`: casos válidos e inválidos de cada parser (correo con mayúsculas se normaliza, correo de 255 caracteres rechazado, contraseña de 7 vs 8 caracteres, fechas imposibles, horas 0/23/24/-1/1.5, courtId 0/1/5/6/"abc")

### Contraseñas y sesiones (research R4, R5)

- [ ] T018 [P] Implementar en `backend/src/lib/password.ts`: `hashPassword(plain): Promise<string>` con `crypto.scrypt` (N=16384, r=8, p=1, salt 16 bytes, clave 64 bytes) en formato `scrypt$<salt_b64>$<hash_b64>`; `verifyPassword(plain, stored): Promise<boolean>` con `crypto.timingSafeEqual`; `DUMMY_HASH` precomputado y `verifyAgainstDummy(plain)` para igualar tiempos cuando el correo no existe (FR-003)
- [ ] T019 [P] Implementar en `backend/src/lib/session.ts`: constantes `SESSION_COOKIE = 'sid'`, `SESSION_TTL_MS = 24 * 3600000`; `createSession(db, userId, nowMs): string` (token `crypto.randomBytes(32).toString('base64url')`, guarda SHA-256 hex en `sessions.token_hash` con `created_at`/`last_seen_at = now`, retorna el token); `setSessionCookie(res, token)` (`httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`, `path: '/'`); `clearSessionCookie(res)`; `destroySession(db, token)`; fábrica `requireSession(db, now)` → middleware que lee `req.cookies.sid`, busca por hash, si no existe o `now - last_seen_at >= 24 h` borra la fila y lanza `httpError(401, 'UNAUTHENTICATED')`, si es válida actualiza `last_seen_at = now` (expiración deslizante FR-004a) y asigna `res.locals.userId`

### App Express

- [ ] T020 Implementar `createApp({ db, now }: { db: Database; now: () => number })` en `backend/src/app.ts`: `express.json({ limit: '10kb' })`, `cookieParser()`, monta routers bajo `/api` (inicialmente vacíos; cada historia los añade), 404 JSON para rutas `/api/*` desconocidas (`INVALID_INPUT`), y `errorHandler` al final. Los handlers async deben pasar errores a `next` (envolver con un helper `asyncHandler` local en `app.ts` o exportado desde `backend/src/lib/httpError.ts`)
- [ ] T021 Implementar `backend/src/server.ts`: `openDb(path.resolve(<repo>/db/padel.db))`, `createApp({ db, now: Date.now })`, escucha en `process.env.PORT ?? 3000` y loguea la URL
- [ ] T022 [P] Crear helper de pruebas en `backend/tests/helpers.ts`: `makeTestApp(nowMs)` que abre `openDb(':memory:')`, crea un reloj mutable (`clock.set(ms)`, `clock.advance(ms)`) y retorna `{ app, db, clock }`; `seedUser(db, email, password)` que inserta un usuario con `hashPassword`; `loginAgent(app, email, password)` que retorna un `supertest.agent` con cookie de sesión (usa `createSession` directo si las rutas de auth aún no existen); fecha fija de referencia `FIXED_NOW = Date.UTC(2026, 9, 26, 15, 30)` (10:30 hora del club)

### Frontend compartido

- [ ] T023 [P] Crear tipos espejo del contrato OpenAPI en `frontend/src/lib/types.ts`: `User`, `Court`, `BookingWindow`, `SlotStatus = 'available' | 'reserved' | 'unavailable'`, `Slot`, `Availability`, `Reservation`, `MyReservations = { upcoming: Reservation[]; history: Reservation[] }`, `ErrorCode` (mismos 12 valores de T013), `ApiError = { code: ErrorCode | 'NETWORK' }`
- [ ] T024 [P] Crear catálogo de mensajes en `frontend/src/lib/errorMessages.ts`: `messageFor(code: string): string` con mensajes en español por cada `ErrorCode` (`SLOT_TAKEN` → "La cancha ya fue reservada en este horario", `UNAUTHENTICATED` → "Tu sesión expiró o no has iniciado sesión", `TOO_MANY_ATTEMPTS` → "Demasiados intentos. Inténtalo de nuevo más tarde.", etc.) y fallback "Ocurrió un problema. Inténtalo de nuevo." para códigos desconocidos y `NETWORK`; nunca devuelve texto del servidor ni código HTTP
- [ ] T025 [P] Escribir pruebas del catálogo en `frontend/tests/errorMessages.test.ts`: cada `ErrorCode` tiene mensaje no vacío, código desconocido y `NETWORK` devuelven el fallback, ningún mensaje contiene "Error", "500", "stack" ni nombres de código en mayúsculas
- [ ] T026 Implementar cliente HTTP en `frontend/src/api/client.ts`: `request<T>(method, path, body?)` sobre `fetch('/api' + path, { credentials: 'same-origin', headers: JSON })`; en respuesta no-OK lanza un objeto `ApiError` con `code` tomado de `body.error.code` (o `INTERNAL` si no parsea); en fallo de red lanza `{ code: 'NETWORK' }`; 204 → `undefined`. Exportar callback configurable `onUnauthenticated` invocado ante cualquier 401 (usado por `AuthContext`)
- [ ] T027 [P] Crear componente `ErrorBanner` (`{ code?: string | null; onClose?: () => void }`) que muestra `messageFor(code)` con `role="alert"` y estilo Tailwind de alerta en `frontend/src/components/ErrorBanner.tsx`
- [ ] T028 Crear `frontend/src/main.tsx` (monta `<BrowserRouter><App/></BrowserRouter>` e importa `index.css`) y un `frontend/src/App.tsx` inicial con `<Routes>` vacío y un layout base (cabecera con nombre del club y `<main>`), listo para que cada historia añada rutas, en `frontend/src/main.tsx` y `frontend/src/App.tsx`

**Checkpoint**: `npm test -w backend` pasa (clubTime, validation); `npm run dev` levanta backend en :3000 y frontend en :5173; `db/padel.db` contiene las 5 canchas.

---

## Phase 3: User Story 1 - Registro e inicio de sesión (Priority: P1) 🎯 MVP

**Goal**: Un visitante se registra con correo y contraseña, inicia y cierra sesión; la sesión expira tras 24 h de inactividad; 5 fallos bloquean el correo 15 min; las áreas protegidas exigen sesión.

**Independent Test**: Registrar una cuenta, cerrar sesión, iniciar sesión con las mismas credenciales y acceder a `/api/auth/me`; sin cookie, `/api/auth/me` responde 401. En la UI, entrar a una ruta protegida sin sesión redirige a `/login`. (quickstart pasos 3–5, 19–22; UI escenario 1.)

### Tests for User Story 1

> **NOTE: Escribir primero; deben FALLAR antes de implementar**

- [ ] T029 [US1] Escribir pruebas de integración en `backend/tests/auth.test.ts` con `makeTestApp(FIXED_NOW)`:
  - `POST /api/auth/register` válido → 201, cuerpo `{ user: { id, email } }` con email normalizado, `Set-Cookie` con `sid`, `HttpOnly`, `SameSite=Lax`; `password_hash` en BD empieza por `scrypt$` y no contiene la contraseña (FR-006)
  - Registro con `Ana@Test.com` y luego `ana@test.com` → 409 `EMAIL_TAKEN` (FR-002)
  - Registro con correo inválido, correo > 254 caracteres o contraseña de 7 caracteres → 400 `INVALID_INPUT`; cuerpo JSON mal formado → 400 `INVALID_INPUT`
  - Login correcto → 200 + cookie; contraseña incorrecta y correo inexistente → 401 `INVALID_CREDENTIALS` con `message` idéntico (FR-003)
  - Lockout (FR-003a): 5 fallos → los 5 responden 401; 6.º intento con contraseña correcta → 429 `TOO_MANY_ATTEMPTS` con header `Retry-After` (segundos); mismo comportamiento para correo inexistente; tras `clock.advance(15 min)` el login correcto responde 200; un login exitoso tras 3 fallos reinicia el contador (luego 4 fallos más no bloquean)
  - `GET /api/auth/me` sin cookie → 401 `UNAUTHENTICATED`; con cookie → 200
  - Expiración deslizante (FR-004a): `clock.advance(23h)` + `/me` → 200; otro `clock.advance(23h)` + `/me` → 200 (renovada); `clock.advance(24h)` sin actividad + `/me` → 401 y la fila de `sessions` fue borrada
  - `POST /api/auth/logout` → 204, cookie limpiada; `/me` con la cookie anterior → 401; logout sin sesión → 204 (idempotente)
  - Ninguna respuesta de error incluye stack ni texto técnico (solo `{ error: { code, message } }`)

### Implementation for User Story 1

- [ ] T030 [P] [US1] Implementar reglas de bloqueo en `backend/src/lib/loginLimiter.ts` sobre la tabla `login_attempts` (clave = correo normalizado, exista o no el usuario): `LOCK_THRESHOLD = 5`, `LOCK_MS = 15 * 60000`; `checkLock(db, email, nowMs): { locked: true; retryAfterSec: number } | { locked: false }` (si `locked_until > now` → bloqueado; si `locked_until <= now` y no nulo → borrar/reiniciar fila); `recordFailure(db, email, nowMs)` (`failed_count += 1`; al llegar a 5 fija `locked_until = now + 15 min`); `recordSuccess(db, email)` (borra la fila). Transiciones exactas de data-model.md § login_attempts
- [ ] T031 [US1] Implementar router de auth en `backend/src/routes/auth.ts` (exporta `authRouter(db, now)`), SQL inline:
  - `POST /register`: valida con `parseEmail`/`parsePassword` → 400 `INVALID_INPUT`; `INSERT INTO users(email, password_hash, created_at)`; captura `SQLITE_CONSTRAINT_UNIQUE` → 409 `EMAIL_TAKEN`; crea sesión, setea cookie, responde 201 `{ user: { id, email } }`
  - `POST /login`: valida formato (400 si inválido); `checkLock` → 429 `TOO_MANY_ATTEMPTS` + `Retry-After` sin verificar contraseña; busca usuario; si no existe ejecuta `verifyAgainstDummy`; si falla → `recordFailure` y 401 `INVALID_CREDENTIALS`; si acierta → `recordSuccess`, `createSession`, cookie, 200 `{ user }`
  - `POST /logout`: si hay cookie `sid` → `destroySession`; `clearSessionCookie`; 204
  - `GET /me`: protegido con `requireSession`; responde `{ user: { id, email } }`
- [ ] T032 [US1] Montar `authRouter` en `/api/auth` dentro de `createApp` en `backend/src/app.ts` y verificar que `backend/tests/auth.test.ts` pasa
- [ ] T033 [P] [US1] Implementar `AuthContext` en `frontend/src/auth/AuthContext.tsx`: estado `user: User | null` y `loading`; al montar llama `GET /auth/me` (401 → `user = null`); expone `login(email, password)`, `register(email, password)`, `logout()` (llaman a `client.ts` y actualizan `user`); registra `onUnauthenticated` del cliente para poner `user = null`; hook `useAuth()`
- [ ] T034 [P] [US1] Implementar `ProtectedRoute` en `frontend/src/auth/ProtectedRoute.tsx`: mientras `loading` muestra "Cargando…"; si `user === null` redirige a `/login?next=<ruta actual>` pasando en `state` el mensaje de `messageFor('UNAUTHENTICATED')` (FR-005, ui-routes "Rutas protegidas")
- [ ] T035 [P] [US1] Implementar `LoginPage` en `frontend/src/pages/LoginPage.tsx`: formulario correo + contraseña (labels accesibles, `type="email"`/`type="password"`), muestra el aviso de sesión expirada si viene en `state`, llama `login`, en éxito navega a `next` (query) o `/`, en error muestra `ErrorBanner` con el `code` (`INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `INVALID_INPUT`); enlace a `/register`; botón deshabilitado mientras envía
- [ ] T036 [P] [US1] Implementar `RegisterPage` en `frontend/src/pages/RegisterPage.tsx`: formulario correo + contraseña con indicación "Mínimo 8 caracteres" y validación cliente (`minLength=8`), llama `register`, en éxito navega a `/` (sesión ya activa, US1-1), en error muestra `ErrorBanner` (`EMAIL_TAKEN` → "Este correo ya está registrado", `INVALID_INPUT`); enlace a `/login`
- [ ] T037 [US1] Integrar auth en `frontend/src/App.tsx` y `frontend/src/main.tsx`: envolver con `<AuthProvider>`; rutas `/login` y `/register`; cabecera con correo del usuario y botón "Cerrar sesión" (llama `logout` y navega a `/login`) o enlaces "Iniciar sesión"/"Registrarse" sin sesión; ruta comodín → `/`

**Checkpoint**: US1 completa — quickstart pasos 3–5 y 19–22 pasan con curl; en la UI se puede registrar, cerrar sesión y volver a entrar.

---

## Phase 4: User Story 2 - Consultar disponibilidad y reservar un bloque (Priority: P1)

**Goal**: Ver las 5 canchas, elegir fecha en un selector de 7 días, ver la grilla de 24 bloques con 3 estados y reservar un bloque con re-validación atómica anti-colisión.

**Independent Test**: Con un usuario sin reservas activas, abrir una cancha, elegir mañana, reservar un bloque "Disponible" y comprobar que pasa a "Reservado" para otro usuario; 50 confirmaciones simultáneas del mismo bloque producen exactamente 1 reserva. (quickstart pasos 1–2, 6–13; UI escenarios 2 y 3.)

**Dependencia**: Backend independiente de US1 (las pruebas crean sesiones con `createSession` vía `helpers.ts`). La UI usa `ProtectedRoute`/`AuthContext` de US1 para llegar a la grilla.

### Tests for User Story 2

> **NOTE: Escribir primero; deben FALLAR antes de implementar**

- [ ] T038 [P] [US2] Escribir pruebas en `backend/tests/courts.test.ts` con `FIXED_NOW` (2026-10-26 10:30 hora club):
  - `GET /api/courts` sin sesión → 200 con exactamente 5 canchas `[{1,'Cancha Laureles'},{2,'Cancha El Poblado'},{3,'Cancha Belén'},{4,'Cancha Robledo'},{5,'Cancha Envigado'}]` y `bookingWindow { from: '2026-10-26', to: '2026-11-01' }` (FR-007, FR-008)
  - `GET /api/courts/1/availability?date=2026-10-26` sin sesión → 401 `UNAUTHENTICATED` (FR-005)
  - Con sesión, hoy → 24 slots ordenados `startHour 0..23`, `label` `"00:00–01:00"`…`"23:00–24:00"`; slots 0–10 (incluido el en curso 10:00) `unavailable`, 11–23 `available` (FR-009, FR-010)
  - Reserva insertada en BD para mañana hora 18 → slot 18 `reserved`; ningún slot incluye `userId`/email (FR-011); reserva cancelada → `available`; reserva de hoy a las 08 → `unavailable` (no `reserved`)
  - `courtId=9`, `courtId=abc`, `date=2026-13-40`, sin `date` → 400 `INVALID_INPUT`; `date` = ayer o hoy+7 → 400 `OUT_OF_BOOKING_WINDOW`
- [ ] T039 [P] [US2] Escribir pruebas de creación en `backend/tests/reservations.test.ts` (bloque `describe('POST /api/reservations')`):
  - Sin sesión → 401; cuerpo válido → 201 con `Reservation { id, court: { id, name }, date, startHour, label, cancellable: true }`; fila con `start_at = slotStartMs`, `end_at = start_at + 3600000`
  - Mismo bloque por otro usuario → 409 `SLOT_TAKEN` con mensaje "La cancha ya fue reservada en este horario." (FR-015)
  - Segunda reserva del mismo usuario en otra cancha → 409 `ACTIVE_RESERVATION_EXISTS` (FR-017); tras `clock.advance` hasta pasar `end_at` de la primera → nueva reserva 201 (edge case "pasa al historial")
  - Hora ya iniciada de hoy y fecha de ayer → 400 `SLOT_IN_PAST`; `clock.set(slotStartMs)` justo al confirmar → 400 `SLOT_IN_PAST` (edge case diálogo abierto); hoy+7 → 400 `OUT_OF_BOOKING_WINDOW`; prioridad de reglas en el orden de data-model.md (p. ej. fecha hoy+7 con usuario con reserva activa → `OUT_OF_BOOKING_WINDOW`)
  - `courtId: 9`, `startHour: 24`, `startHour: 1.5`, `date: "2026-13-40"`, campos faltantes o extra (`additionalProperties: false`) → 400 `INVALID_INPUT`; ninguna fila creada
  - Bloque 23 de hoy+6 → 201, `end_at` = 00:00 del día siguiente
- [ ] T040 [P] [US2] Escribir prueba de concurrencia SC-001 en `backend/tests/concurrency.test.ts`:
  - Variante HTTP: BD en archivo temporal (`os.tmpdir()`), 50 usuarios distintos con sesión, `Promise.all` de 50 `POST /api/reservations` al mismo `(courtId, date, startHour)` → exactamente 1×201, 49×409 `SLOT_TAKEN`, y `SELECT COUNT(*) FROM reservations WHERE cancelled_at IS NULL` = 1; repetir 20 veces (limpiando reservas entre iteraciones)
  - Variante multi-hilo: `worker_threads` (N≥8 workers) que abren el mismo archivo `padel.db` con `openDb` y llaman `createReservation` (T042) para usuarios distintos sobre el mismo bloque, con `busy_timeout` configurado → exactamente 1 éxito, resto `SLOT_TAKEN`, 1 fila; repetir 20 veces. El worker vive en `backend/tests/concurrencyWorker.ts`
- [ ] T041 [P] [US2] Escribir pruebas de componentes en `frontend/tests/SlotGrid.test.tsx` y `frontend/tests/DayPicker.test.tsx`: `SlotGrid` con 24 slots muestra 24 celdas con su `label` y el texto "Disponible"/"Reservado"/"No disponible" (no solo color); solo las `available` son botones habilitados y llaman `onSelect(startHour)`; `DayPicker` con `bookingWindow { from: '2026-10-26', to: '2026-11-01' }` muestra exactamente 7 días, marca el seleccionado con `aria-pressed`, y llama `onChange(date)`

### Implementation for User Story 2

- [ ] T042 [US2] Implementar router de canchas en `backend/src/routes/courts.ts` (exporta `courtsRouter(db, now)`), SQL inline:
  - `GET /`: público; `SELECT id, name FROM courts ORDER BY id`; responde `{ courts, bookingWindow: bookingWindow(now()) }`. Ningún handler escribe en `courts` (Principio II)
  - `GET /:courtId/availability`: `requireSession`; `parseCourtId` y `parseDate(req.query.date)` → 400 `INVALID_INPUT`; fecha fuera de `bookingWindow` → 400 `OUT_OF_BOOKING_WINDOW`; una consulta `SELECT start_hour FROM reservations WHERE court_id = ? AND date = ? AND cancelled_at IS NULL`; construye 24 slots con `status = isSlotStarted ? 'unavailable' : reservado ? 'reserved' : 'available'` y `label = slotLabel(hour)`; responde `{ court, date, bookingWindow, slots }` sin datos de usuario (FR-011)
- [ ] T043 [US2] Implementar creación atómica en `backend/src/routes/reservations.ts`: función exportada `createReservation(db, { userId, courtId, date, startHour }, nowMs)` que ejecuta `db.transaction(...).immediate()` (`BEGIN IMMEDIATE`) aplicando en orden las reglas de data-model.md: (2) `date` ≤ hoy+6 → 400 `OUT_OF_BOOKING_WINDOW`; (3) `slotStartMs(date, startHour) <= now` (cubre fechas pasadas) → 400 `SLOT_IN_PAST`; (4) `SELECT 1 FROM reservations WHERE user_id = ? AND cancelled_at IS NULL AND end_at > ?` → 409 `ACTIVE_RESERVATION_EXISTS`; (5) `SELECT 1 … WHERE court_id = ? AND date = ? AND start_hour = ? AND cancelled_at IS NULL` → 409 `SLOT_TAKEN`; luego `INSERT` con `start_at`, `end_at = start_at + 3600000`, `created_at = now`; captura `SQLITE_CONSTRAINT_UNIQUE` → 409 `SLOT_TAKEN` (red final del índice `ux_reservations_slot`). Retorna la fila con el nombre de la cancha. Exportar también `toReservationDto(row, nowMs)` → `{ id, court: { id, name }, date, startHour, label, cancellable: start_at > now }`
- [ ] T044 [US2] Implementar `POST /` en el router de reservas (`reservationsRouter(db, now)` en `backend/src/routes/reservations.ts`): `requireSession`; rechaza cuerpo que no sea objeto o con claves distintas de `courtId`, `date`, `startHour` → 400 `INVALID_INPUT`; regla (1) con `parseCourtId`, `parseDate`, `parseStartHour` → 400 `INVALID_INPUT`; llama `createReservation(db, …, now())`; responde 201 con `toReservationDto`
- [ ] T045 [US2] Montar `courtsRouter` en `/api/courts` y `reservationsRouter` en `/api/reservations` dentro de `createApp`; en `openDb` (`backend/src/db.ts`) añadir `PRAGMA busy_timeout = 5000` para la variante multi-proceso; verificar que `courts.test.ts`, la parte POST de `reservations.test.ts` y `concurrency.test.ts` pasan en `backend/src/app.ts`
- [ ] T046 [P] [US2] Implementar `DayPicker` en `frontend/src/components/DayPicker.tsx`: props `{ window: BookingWindow; value: string; onChange: (date: string) => void }`; genera los 7 días de `window.from` a `window.to` sin usar el reloj del cliente; botones con día de la semana y fecha en español (`Intl.DateTimeFormat('es-CO', { timeZone: 'UTC' })` sobre la fecha `YYYY-MM-DD`), `aria-pressed` en el seleccionado
- [ ] T047 [P] [US2] Implementar `SlotGrid` en `frontend/src/components/SlotGrid.tsx`: props `{ slots: Slot[]; onSelect: (startHour: number) => void; disabled?: boolean }`; grilla responsive Tailwind de 24 celdas; cada celda muestra `label` + texto de estado ("Disponible" verde y botón habilitado, "Reservado" gris/rojo deshabilitado, "No disponible" gris deshabilitado); estado comunicado por texto, no solo color
- [ ] T048 [P] [US2] Implementar `ConfirmDialog` en `frontend/src/components/ConfirmDialog.tsx`: props `{ open; title; message; confirmLabel; cancelLabel; onConfirm; onCancel; busy? }`; diálogo modal accesible (`role="dialog"`, `aria-modal`, foco en el botón de confirmar, Escape = cancelar); reutilizado en US3
- [ ] T049 [US2] Implementar `CourtsPage` en `frontend/src/pages/CourtsPage.tsx`: `GET /courts`; lista las 5 canchas; con sesión cada una enlaza a `/courts/:id`; sin sesión muestra "Inicia sesión para ver disponibilidad" con enlace a `/login?next=/courts/:id` (ui-routes); errores con `ErrorBanner`
- [ ] T050 [US2] Implementar `CourtAvailabilityPage` en `frontend/src/pages/CourtAvailabilityPage.tsx`: lee `:courtId`; carga `GET /courts/:id/availability?date=<fecha>` (primera carga sin fecha elegida usa `bookingWindow.from` de `GET /courts`); renderiza nombre de la cancha, `DayPicker` (hoy por defecto) y `SlotGrid`; al seleccionar un bloque abre `ConfirmDialog` con "Reservar {cancha} el {fecha} de {label}"; al confirmar `POST /reservations`; en 201 muestra confirmación "Reserva confirmada" y recarga la grilla; en cualquier 409 (`SLOT_TAKEN`, `ACTIVE_RESERVATION_EXISTS`) o 400 (`SLOT_IN_PAST`, `OUT_OF_BOOKING_WINDOW`) muestra `ErrorBanner` y recarga la grilla (FR-015, research R10); 401 → redirección vía `AuthContext`
- [ ] T051 [US2] Añadir rutas en `frontend/src/App.tsx`: `/` → `CourtsPage` (pública) y `/courts/:courtId` → `CourtAvailabilityPage` dentro de `ProtectedRoute`; enlace "Canchas" en la cabecera

**Checkpoint**: US1 + US2 funcionan — quickstart pasos 1–2 y 6–13 pasan; prueba de concurrencia verde en 20 repeticiones; escenario UI de conflicto con dos navegadores muestra el mensaje y la grilla actualizada.

---

## Phase 5: User Story 3 - Gestionar "Mis Reservas" (Priority: P2)

**Goal**: Panel con reservas próximas (futuras y en curso) e historial (pasadas, sin canceladas); cancelar una reserva futura propia con confirmación.

**Independent Test**: Con un usuario con una reserva futura y una pasada, abrir `/my-reservations`, ver ambas listas, pulsar "Cancelar" → "No" (sigue) y "Sí" (desaparece); la grilla muestra el bloque "Disponible". (quickstart pasos 14–18; UI escenario 4.)

**Dependencia**: Backend independiente (las pruebas insertan reservas directamente en BD); reutiliza `toReservationDto` (T043) y `ConfirmDialog` (T048). La UI usa `ProtectedRoute` de US1.

### Tests for User Story 3

> **NOTE: Escribir primero; deben FALLAR antes de implementar**

- [ ] T052 [US3] Añadir a `backend/tests/reservations.test.ts` los bloques `describe('GET /api/reservations/me')` y `describe('DELETE /api/reservations/:id')`:
  - `/me` sin sesión → 401; usuario sin reservas → `{ upcoming: [], history: [] }` (US3-2)
  - Usuario con reserva futura, en curso (`start_at ≤ now < end_at`), pasada y cancelada → `upcoming` = [en curso (`cancellable: false`), futura (`cancellable: true`)] orden ascendente; `history` = [pasada (`cancellable: false`)] orden descendente; la cancelada no aparece (FR-018); cada ítem incluye `court.name`, `date`, `label`; nunca aparecen reservas de otro usuario (FR-021)
  - `DELETE` de reserva futura propia → 204; fila con `cancelled_at = now`; disponibilidad de ese bloque vuelve a `available`; el usuario puede crear otra reserva inmediatamente (FR-020, edge case)
  - `DELETE` repetido (ya cancelada) → 404 `RESERVATION_NOT_FOUND`; id inexistente → 404; reserva de otro usuario → 404 y la reserva sigue intacta (FR-021); id `abc` o `0` → 400 `INVALID_INPUT`; sin sesión → 401
  - `DELETE` de reserva en curso o pasada → 400 `RESERVATION_NOT_CANCELLABLE` y la fila no cambia (US3-6)

### Implementation for User Story 3

- [ ] T053 [US3] Implementar `GET /me` en `reservationsRouter` (`backend/src/routes/reservations.ts`): `requireSession`; `SELECT r.*, c.name AS court_name FROM reservations r JOIN courts c ON c.id = r.court_id WHERE r.user_id = ? AND r.cancelled_at IS NULL`; separa `upcoming` (`end_at > now`, orden `start_at ASC`) e `history` (`end_at <= now`, orden `start_at DESC`); mapea con `toReservationDto` (`cancellable = start_at > now`). Declarar esta ruta ANTES de `/:reservationId`
- [ ] T054 [US3] Implementar `DELETE /:reservationId` en `reservationsRouter` (`backend/src/routes/reservations.ts`): `requireSession`; `parsePositiveId` → 400 `INVALID_INPUT`; en una transacción: `UPDATE reservations SET cancelled_at = :now WHERE id = ? AND user_id = :currentUser AND cancelled_at IS NULL AND start_at > :now`; si 0 filas, `SELECT start_at FROM reservations WHERE id = ? AND user_id = ? AND cancelled_at IS NULL` → si existe (ya empezó/pasó) 400 `RESERVATION_NOT_CANCELLABLE`, si no 404 `RESERVATION_NOT_FOUND` (no distingue ajena/inexistente/cancelada); éxito → 204; verificar que `backend/tests/reservations.test.ts` completo pasa
- [ ] T055 [US3] Implementar `MyReservationsPage` en `frontend/src/pages/MyReservationsPage.tsx`: carga `GET /reservations/me`; secciones "Próximas" e "Historial", cada ítem con nombre de la cancha, fecha legible en español y `label`; si ambas listas están vacías muestra "Aún no tienes reservas" (US3-2); botón "Cancelar" solo si `cancellable === true`; abre `ConfirmDialog` ("¿Seguro que quieres cancelar la reserva de {cancha} el {fecha} de {label}?", "Sí, cancelar" / "No"); "No" cierra sin llamar a la API (US3-4); "Sí" llama `DELETE /reservations/:id` y recarga la lista; errores (`RESERVATION_NOT_FOUND`, `RESERVATION_NOT_CANCELLABLE`) con `ErrorBanner` + recarga
- [ ] T056 [US3] Añadir ruta `/my-reservations` → `MyReservationsPage` dentro de `ProtectedRoute` y enlace "Mis Reservas" en la cabecera (solo con sesión) en `frontend/src/App.tsx`; tras reservar en `CourtAvailabilityPage` mostrar enlace "Ver Mis Reservas" en el mensaje de confirmación (`frontend/src/pages/CourtAvailabilityPage.tsx`)

**Checkpoint**: Las tres historias funcionan de forma independiente; quickstart pasos 14–18 y escenario UI 4 pasan.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación transversal de errores, trazabilidad y validación final

- [ ] T057 [P] Revisar que ningún componente/página muestre `error.message` del servidor, códigos HTTP ni stack: todas las rutas de error pasan por `messageFor`; con el backend detenido, cualquier acción muestra "Ocurrió un problema. Inténtalo de nuevo." (SC-006, quickstart UI 5) en `frontend/src/api/client.ts` y `frontend/src/pages/*.tsx`
- [ ] T058 [P] Añadir prueba en `backend/tests/auth.test.ts` (o nuevo `describe` en ese archivo) que fuerza una excepción interna (ruta de prueba montada solo en el test sobre `createApp`, o BD cerrada) y verifica 500 `{ error: { code: 'INTERNAL', message } }` sin stack en el cuerpo (Principio V)
- [ ] T059 [P] Auditoría de código sombra (Principio VI): `grep` en `backend/src` y `frontend/src` confirma que no existen escrituras sobre `courts` (`INSERT|UPDATE|DELETE` + `courts` fuera de `db/schema.sql`), ni endpoints/pantallas no listados en `contracts/openapi.yaml` y `contracts/ui-routes.md`; eliminar lo que sobre
- [ ] T060 [P] Verificar responsividad móvil (Tailwind) de `SlotGrid`, `DayPicker` y formularios a 360 px de ancho sin scroll horizontal en `frontend/src/components/SlotGrid.tsx` y `frontend/src/components/DayPicker.tsx`
- [ ] T061 Ejecutar `npm test` en la raíz (backend + frontend) y `npm run build -w frontend`; corregir fallos de tipos o pruebas
- [ ] T062 Ejecutar la guía `specs/001-padel-court-booking/quickstart.md` completa: `npm run db:reset`, `npm run dev`, los 22 pasos de API con curl (o Postman CLI importando `contracts/openapi.yaml`) y los 5 escenarios UI; registrar cualquier desviación como tarea de corrección

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T009 depende de T001, T003, T005.
- **Foundational (Phase 2)**: depende de Setup. BLOQUEA todas las historias.
  - T011 depende de T010; T012 de T011; T020 de T011, T013, T019; T021 de T020; T022 de T011, T018, T019, T020.
  - T026 depende de T023; T027 de T024; T028 de T027.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational. Backend sin dependencia de US1; UI depende de T033/T034 (AuthContext, ProtectedRoute).
- **US3 (Phase 5)**: depende de Foundational y de T043 (`toReservationDto`, router de reservas) y T048 (`ConfirmDialog`) de US2.
- **Polish (Phase 6)**: depende de las historias deseadas completas.

### User Story Dependencies

```text
Setup ─▶ Foundational ─┬─▶ US1 (P1) ──────────────┐
                       ├─▶ US2 (P1) backend ──────┼─▶ US2 UI (usa AuthContext de US1)
                       │        │                 │
                       │        └─▶ US3 (P2) ─────┴─▶ Polish
```

### Within Each User Story

- Pruebas primero (deben fallar) → lib/utilidades → rutas backend → montaje en `app.ts` → componentes → páginas → rutas en `App.tsx`.
- `backend/src/routes/reservations.ts` es compartido por US2 (T043, T044) y US3 (T053, T054): esas tareas son secuenciales, nunca [P] entre sí.
- `backend/tests/reservations.test.ts` lo editan T039 y T052: secuenciales.
- `frontend/src/App.tsx` lo editan T028, T037, T051, T056: secuenciales.

### Parallel Opportunities

- Setup: T002–T008 en paralelo tras T001.
- Foundational: T013, T014, T015, T016, T017, T018, T019, T023, T024, T025 en paralelo; T022 y T027 tras sus dependencias.
- US1: T030, T033, T034, T035, T036 en paralelo (archivos distintos) tras escribir T029.
- US2: T038, T039, T040, T041 en paralelo; luego T046, T047, T048 en paralelo con el backend T042–T045.
- US1 backend y US2 backend pueden desarrollarse en paralelo por personas distintas tras Foundational.

---

## Parallel Example: User Story 2

```bash
# Pruebas de US2 en paralelo (archivos distintos):
Task: "T038 Pruebas de canchas/disponibilidad en backend/tests/courts.test.ts"
Task: "T039 Pruebas de POST /api/reservations en backend/tests/reservations.test.ts"
Task: "T040 Prueba de concurrencia SC-001 en backend/tests/concurrency.test.ts"
Task: "T041 Pruebas de SlotGrid y DayPicker en frontend/tests/"

# Componentes de US2 en paralelo mientras se hace el backend:
Task: "T046 DayPicker en frontend/src/components/DayPicker.tsx"
Task: "T047 SlotGrid en frontend/src/components/SlotGrid.tsx"
Task: "T048 ConfirmDialog en frontend/src/components/ConfirmDialog.tsx"
```

## Parallel Example: User Story 1

```bash
Task: "T030 loginLimiter en backend/src/lib/loginLimiter.ts"
Task: "T033 AuthContext en frontend/src/auth/AuthContext.tsx"
Task: "T034 ProtectedRoute en frontend/src/auth/ProtectedRoute.tsx"
Task: "T035 LoginPage en frontend/src/pages/LoginPage.tsx"
Task: "T036 RegisterPage en frontend/src/pages/RegisterPage.tsx"
```

---

## Implementation Strategy

### MVP First

US1 sola no entrega el valor central (reservar); el MVP útil es **US1 + US2** (ambas P1):

1. Phase 1: Setup
2. Phase 2: Foundational (CRÍTICO)
3. Phase 3: US1 → validar quickstart pasos 3–5, 19–22
4. Phase 4: US2 → validar quickstart pasos 1–2, 6–13 y la prueba de concurrencia (Principio I, NO NEGOCIABLE)
5. **STOP y VALIDAR**: demo de registro → reserva en < 1 min (SC-002)

### Incremental Delivery

1. Setup + Foundational → base lista
2. + US1 → autenticación demostrable
3. + US2 → MVP: reservas sin colisiones
4. + US3 → gestión y cancelación
5. Polish → validación completa del quickstart

### Parallel Team Strategy

1. Todo el equipo: Setup + Foundational
2. Luego: Dev A → US1 (backend + UI auth); Dev B → US2 backend (T038–T040, T042–T045); Dev C → componentes US2 (T041, T046–T048)
3. US3 al terminar T043/T048

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] mapea cada tarea a su historia para trazabilidad
- Hacer commit tras cada tarea o grupo lógico
- Ante cualquier contradicción con la constitución o falla lógica del spec: detenerse y actualizar `spec.md` primero (Flujo SDD)
