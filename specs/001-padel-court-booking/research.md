# Research: Reserva de Canchas de Pádel

**Feature**: `specs/001-padel-court-booking` | **Date**: 2026-10-26

El stack lo fija la constitución (React + Tailwind, Node.js + Express, SQLite con
`better-sqlite3`, TypeScript en todo el stack). Este documento resuelve las decisiones técnicas
que el spec y la constitución dejan abiertas.

---

## R1. Atomicidad anti-colisión (FR-014, SC-001, Principio I)

- **Decision**: Doble garantía en la base de datos:
  1. Índice único parcial `UNIQUE (court_id, date, start_hour) WHERE cancelled_at IS NULL` en
     `reservations`.
  2. La creación se ejecuta dentro de `db.transaction(...).immediate()` de `better-sqlite3`
     (`BEGIN IMMEDIATE`): dentro de la transacción se re-valida que el bloque esté libre, que el
     usuario no tenga reserva activa y que el bloque no haya empezado; luego se inserta. Si el
     `INSERT` viola el índice (`SQLITE_CONSTRAINT_UNIQUE`), se traduce a HTTP 409 `SLOT_TAKEN`.
- **Rationale**: `better-sqlite3` es síncrono, así que en un solo proceso Node las transacciones
  ya se serializan; `BEGIN IMMEDIATE` toma el lock de escritura desde el inicio y protege también
  si hubiera varios procesos sobre el mismo `padel.db`. El índice parcial es la red de seguridad
  final: aunque una ruta de código olvide la validación, la BD rechaza el duplicado. El índice es
  parcial para que un bloque cancelado pueda volver a reservarse (FR-020).
- **Alternatives considered**:
  - Solo validar con `SELECT` y luego `INSERT` sin transacción: viola el Principio I.
  - Lock en memoria (mutex por bloque): no sobrevive a varios procesos y duplica lo que SQLite ya
    garantiza.
  - `UNIQUE` total sin `WHERE`: impediría re-reservar un bloque cancelado.

## R2. Regla "una reserva activa por usuario" (FR-017)

- **Decision**: Verificación dentro de la misma transacción `IMMEDIATE` de R1:
  `SELECT 1 FROM reservations WHERE user_id = ? AND cancelled_at IS NULL AND end_at > :now`.
  Si existe → 409 `ACTIVE_RESERVATION_EXISTS`.
- **Rationale**: "Activa" depende del reloj (hora de fin aún no pasó), por lo que no puede
  expresarse como índice único estático. Al estar dentro de la transacción `IMMEDIATE`, dos
  reservas simultáneas del mismo usuario en canchas distintas también quedan serializadas.
- **Alternatives considered**: Columna `is_active` mantenida por un job: añade un proceso de
  fondo y estado que puede quedar desincronizado; innecesario.

## R3. Zona horaria y representación del tiempo (Assumptions, FR-010, FR-016)

- **Decision**: Toda la lógica de calendario usa la zona `America/Bogota` (UTC−5 fijo, sin horario
  de verano). Una reserva se guarda como `date` (`YYYY-MM-DD` local del club) + `start_hour`
  (0–23), y además `start_at` / `end_at` como epoch ms (UTC) derivados, para comparar contra
  `now` con enteros. Un módulo puro `clubTime.ts` expone: `clubToday(now)`,
  `bookingWindow(now)` (hoy … hoy+6), `slotStartMs(date, hour)`, `isSlotStarted(date, hour, now)`.
  El reloj se inyecta (`now: () => number`) para poder probar con tiempo fijo.
- **Rationale**: Colombia no tiene DST, así que el offset fijo −05:00 es exacto y evita
  dependencias de fechas. El bloque 23:00–24:00 termina a las 00:00 del día siguiente
  (`end_at = start_at + 3 600 000`) y pertenece a la fecha seleccionada (edge case del spec).
- **Alternatives considered**: `date-fns-tz` / `luxon`: dependencia extra sin beneficio con
  offset fijo. Guardar solo ISO strings: comparaciones de texto más frágiles.

## R4. Sesiones (FR-003, FR-004, FR-004a, FR-005)

- **Decision**: Sesiones del lado del servidor en la tabla `sessions` (id aleatorio de 32 bytes,
  `crypto.randomBytes` → base64url; se guarda el hash SHA-256 del token, no el token).
  Cookie `sid` `HttpOnly`, `SameSite=Lax`, `Secure` en producción, `Path=/`. Middleware
  `requireSession`: busca la sesión, si `last_seen_at + 24h < now` la borra y responde 401
  `UNAUTHENTICATED`; si es válida actualiza `last_seen_at` (expiración deslizante de 24 h).
  Logout borra la fila y limpia la cookie.
- **Rationale**: Cumple la expiración por inactividad sin lógica de refresh tokens; permite
  invalidar sesiones al hacer logout (un JWT no se puede revocar sin lista negra). Es una tabla y
  un middleware: dentro del Principio III.
- **Alternatives considered**: `express-session` + store SQLite: dependencia adicional para
  algo de ~40 líneas. JWT en cookie: no hay revocación real en logout ni deslizamiento simple.

## R5. Hash de contraseñas (FR-006)

- **Decision**: `crypto.scrypt` nativo de Node (N=16384, r=8, p=1, salt de 16 bytes, clave de
  64 bytes), formato almacenado `scrypt$<salt_b64>$<hash_b64>`, comparación con
  `crypto.timingSafeEqual`. Si el correo no existe se ejecuta igualmente un scrypt contra un hash
  ficticio para igualar tiempos (no revelar existencia de cuentas, FR-003).
- **Rationale**: Algoritmo de derivación de claves resistente a fuerza bruta, sin dependencias
  nativas adicionales.
- **Alternatives considered**: `bcrypt` (dependencia nativa extra); `argon2` (mejor, pero otra
  compilación nativa; scrypt es suficiente para el alcance).

## R6. Bloqueo por intentos fallidos (FR-003a, SC-005)

- **Decision**: Tabla `login_attempts (email PK, failed_count, locked_until)` indexada por correo
  normalizado (trim + minúsculas), exista o no el usuario. Flujo de login:
  1. Si `locked_until > now` → 429 `TOO_MANY_ATTEMPTS` sin verificar contraseña.
  2. Si `locked_until` ya pasó → reiniciar contador.
  3. Credenciales incorrectas → `failed_count += 1`; al llegar a 5 → `locked_until = now + 15 min`
     y responder 429 a partir del siguiente intento (el 5.º fallo responde 401 genérico).
  4. Éxito → borrar la fila.
- **Rationale**: Por correo (no por IP) es lo que pide el spec; aplicarlo a correos inexistentes
  evita enumeración de cuentas. Persistido en SQLite para sobrevivir reinicios.
- **Alternatives considered**: `express-rate-limit` (limita por IP, no por correo; no cubre la
  regla). Contador en memoria: se pierde al reiniciar.

## R7. Contrato de errores (FR-022, FR-023, Principio V)

- **Decision**: Toda respuesta de error es `{ "error": { "code": "<CODE>", "message": "<texto en
  español amigable>" } }`. Códigos HTTP: 400 (validación, pasado, fuera de ventana, no
  cancelable), 401 (sin sesión / credenciales inválidas), 404 (reserva inexistente, ajena o ya
  cancelada), 409 (bloque tomado, reserva activa existente, correo ya registrado), 429 (demasiados
  intentos). Un middleware final de Express captura cualquier excepción no prevista y responde
  500 `INTERNAL` con mensaje genérico, registrando el detalle solo en el log del servidor. El
  frontend mapea `code` → mensaje (catálogo en `frontend/src/lib/errorMessages.ts`), con
  mensaje genérico de respaldo; nunca muestra texto técnico.
- **Rationale**: Los 400/401/409 exigidos por la constitución se respetan; 404 y 429 son
  necesarios para FR-021 (sin revelar reservas ajenas) y FR-023 (distinguir "demasiados intentos").
  No contradicen la constitución, que exige *al menos* semántica HTTP correcta.
- **Alternatives considered**: 403 para reservas ajenas: revela que la reserva existe; 404 es
  más seguro. Usar solo 400 para todo: viola FR-023.

## R8. Validación de entradas

- **Decision**: Funciones puras escritas a mano en `backend/src/lib/validation.ts`
  (`parseEmail`, `parsePassword`, `parseDate`, `parseStartHour`, `parseCourtId`) que retornan
  `{ ok: true, value } | { ok: false, code }`. `express.json({ limit: '10kb' })` limita el cuerpo.
- **Rationale**: Son 5 campos; una librería de esquemas (zod) sería aceptable pero no necesaria
  (Principio III). Las funciones puras se prueban unitariamente.
- **Alternatives considered**: `zod` — rechazado por sobredimensionado para 5 campos.

## R9. Frontend: routing, estado y calendario

- **Decision**: Vite + React 18 + TypeScript + Tailwind CSS v4 (plugin `@tailwindcss/vite`);
  `react-router-dom` v6 para 5 rutas; estado con hooks (`useState`, `useEffect`) y un
  `AuthContext` mínimo (usuario actual desde `GET /api/auth/me`). Sin librería de data-fetching.
  El "calendario" (FR-008) es un selector de 7 días (`DayPicker`) generado a partir de
  `bookingWindow` que devuelve el backend en la respuesta de disponibilidad / `GET /api/courts`
  (`window.from`, `window.to`), para que el cliente no dependa de su propio reloj/zona.
- **Rationale**: Mostrar solo los 7 días válidos hace imposible elegir una fecha fuera de ventana
  (FR-008) y es más claro que un `<input type="date">` cuyos límites algunos navegadores no
  imponen al teclear. El backend sigue validando (FR-016).
- **Alternatives considered**: Librería de calendario (react-day-picker): dependencia para
  mostrar 7 botones. Redux/React Query: sobreingeniería para 4 pantallas.

## R10. Actualización de la grilla tras conflicto (FR-015, FR-020)

- **Decision**: Tras cualquier 409 al reservar, o tras crear/cancelar, el cliente vuelve a pedir
  `GET /api/courts/:courtId/availability?date=…`. No hay WebSockets ni polling.
- **Rationale**: El spec exige mostrar el estado actualizado al usuario que recibe el conflicto,
  no actualización en tiempo real para todos; "vuelve a mostrarse Disponible para todos" se
  cumple en la siguiente consulta. Tiempo real sería código sombra (Principio VI).

## R11. Pruebas

- **Decision**:
  - **Backend**: Vitest + Supertest contra `createApp({ db, now })` con BD SQLite en memoria
    (`:memory:`) o archivo temporal; reloj fijo inyectado.
  - **Concurrencia (SC-001)**: prueba que lanza 50 `POST /api/reservations` en paralelo (50
    usuarios distintos, mismo bloque) y verifica 1×201 + 49×409 `SLOT_TAKEN` y exactamente 1 fila;
    más una variante con `worker_threads` donde varios hilos abren el mismo archivo `padel.db`
    y ejecutan la función de creación, para probar la garantía a nivel de BD y no solo del event
    loop. Se repite N=20 veces.
  - **Frontend**: Vitest + React Testing Library para `SlotGrid` (3 estados), `DayPicker` y el
    mapeo de errores.
  - Validación end-to-end manual guiada por `quickstart.md` (SC-002, SC-003, SC-007).
- **Rationale**: Un único runner (Vitest) en ambos paquetes; cubre los requisitos críticos
  (Principio I) con pruebas automatizadas reproducibles.
- **Alternatives considered**: Playwright E2E — útil pero no requerido por el spec; se puede
  añadir en una iteración posterior.

## R12. Organización del repositorio y ejecución

- **Decision**: Raíz con `package.json` de npm workspaces (`frontend`, `backend`) y scripts
  `dev`, `test`, `db:reset`. `/db` contiene `schema.sql` (con `CREATE TABLE IF NOT EXISTS` y el
  seed idempotente de las 5 canchas vía `INSERT OR IGNORE`) y el archivo `padel.db`
  (git-ignorado). El backend aplica `schema.sql` al arrancar. En desarrollo, Vite hace proxy de
  `/api` a Express (`localhost:3000`), así frontend y API comparten origen y la cookie
  `SameSite=Lax` funciona sin CORS. Backend en dev con `tsx watch`.
  Node.js ≥ 20 (instalado: v20.17.0).
- **Rationale**: Estructura plana exigida por el Principio III; un solo comando para levantar
  todo; sin sistema de migraciones (esquema único en la primera iteración).
- **Alternatives considered**: Herramienta de migraciones (knex, umzug): innecesaria para un
  esquema inicial; CORS con credenciales: más configuración y superficie de error que el proxy.
