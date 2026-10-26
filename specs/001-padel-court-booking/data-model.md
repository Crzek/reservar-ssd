# Data Model: Reserva de Canchas de Pádel

**Feature**: `specs/001-padel-court-booking` | **Date**: 2026-10-26
**Storage**: SQLite (`db/padel.db`), esquema en `db/schema.sql`, acceso con `better-sqlite3`.
Todas las marcas de tiempo `*_at` son epoch en milisegundos (UTC). Las fechas de calendario
(`date`) son `YYYY-MM-DD` en la hora local del club (`America/Bogota`, UTC−5). Ver
[research.md](./research.md) R3.

`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;` al abrir la conexión.

---

## Entidades

### `users` — Usuario

| Campo           | Tipo    | Reglas |
|-----------------|---------|--------|
| `id`            | INTEGER | PK autoincremental |
| `email`         | TEXT    | NOT NULL, UNIQUE; normalizado (trim + minúsculas) antes de guardar → unicidad sin distinguir mayúsculas (FR-002) |
| `password_hash` | TEXT    | NOT NULL; formato `scrypt$<salt>$<hash>` (FR-006) |
| `created_at`    | INTEGER | NOT NULL |

**Validación** (FR-002): correo con formato válido (`local@dominio.tld`, ≤ 254 caracteres);
contraseña ≥ 8 caracteres. Correo duplicado → 409 `EMAIL_TAKEN`.

### `sessions` — Sesión

| Campo          | Tipo    | Reglas |
|----------------|---------|--------|
| `token_hash`   | TEXT    | PK; SHA-256 del token de la cookie `sid` |
| `user_id`      | INTEGER | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `created_at`   | INTEGER | NOT NULL |
| `last_seen_at` | INTEGER | NOT NULL; se actualiza en cada petición autenticada |

**Reglas** (FR-004a): la sesión es válida si `now - last_seen_at < 24 h`; si no, se borra y la
petición se trata como no autenticada (401). Logout borra la fila (FR-004).
Índice: `idx_sessions_user (user_id)`.

### `login_attempts` — Control de intentos fallidos

| Campo          | Tipo    | Reglas |
|----------------|---------|--------|
| `email`        | TEXT    | PK; correo normalizado, exista o no un usuario (FR-003a) |
| `failed_count` | INTEGER | NOT NULL DEFAULT 0 |
| `locked_until` | INTEGER | NULL; epoch ms hasta el que el correo está bloqueado |

**Transiciones** (FR-003a):

```text
(sin fila) --fallo--> failed_count=1 --…--> failed_count=4 --fallo--> failed_count=5, locked_until=now+15min
bloqueado (locked_until > now) --cualquier intento--> 429, sin verificar contraseña, sin cambios
bloqueado vencido (locked_until <= now) --siguiente intento--> fila reiniciada, se evalúa normalmente
cualquier estado no bloqueado --login exitoso--> fila eliminada
```

### `courts` — Cancha

| Campo  | Tipo    | Reglas |
|--------|---------|--------|
| `id`   | INTEGER | PK (1–5, fijos) |
| `name` | TEXT    | NOT NULL, UNIQUE |

**Seed inmutable** (FR-007, Principio II), insertado con `INSERT OR IGNORE` en `schema.sql`:

| id | name |
|----|------|
| 1 | Cancha Laureles |
| 2 | Cancha El Poblado |
| 3 | Cancha Belén |
| 4 | Cancha Robledo |
| 5 | Cancha Envigado |

No existe ningún endpoint ni código que haga `INSERT`/`UPDATE`/`DELETE` sobre `courts`.

### `reservations` — Reserva

| Campo          | Tipo    | Reglas |
|----------------|---------|--------|
| `id`           | INTEGER | PK autoincremental |
| `user_id`      | INTEGER | NOT NULL, FK → `users.id` |
| `court_id`     | INTEGER | NOT NULL, FK → `courts.id` |
| `date`         | TEXT    | NOT NULL, `YYYY-MM-DD` (hora local del club) |
| `start_hour`   | INTEGER | NOT NULL, `CHECK (start_hour BETWEEN 0 AND 23)` (FR-013) |
| `start_at`     | INTEGER | NOT NULL; epoch ms de `date` + `start_hour` en UTC−5 |
| `end_at`       | INTEGER | NOT NULL; `start_at + 3 600 000` (bloque 23:00 termina a las 00:00 del día siguiente) |
| `created_at`   | INTEGER | NOT NULL |
| `cancelled_at` | INTEGER | NULL; no nulo ⇒ reserva cancelada |

**Índices**:

- `ux_reservations_slot` — `UNIQUE (court_id, date, start_hour) WHERE cancelled_at IS NULL`
  → a lo sumo una reserva no cancelada por bloque (FR-014, Principio I).
- `idx_reservations_user (user_id, cancelled_at, end_at)` → "Mis Reservas" y regla de reserva
  activa.

**Reglas de validación al crear** (todas dentro de una transacción `BEGIN IMMEDIATE`,
evaluadas con `now` del momento de la confirmación):

| Orden | Regla | Error |
|-------|-------|-------|
| 1 | `courtId` ∈ {1..5}, `date` con formato válido, `startHour` entero 0–23 | 400 `INVALID_INPUT` |
| 2 | `date` ≤ hoy+6 (hora del club) | 400 `OUT_OF_BOOKING_WINDOW` (FR-016) |
| 3 | `start_at > now` (cubre también fechas pasadas) | 400 `SLOT_IN_PAST` (FR-016, US2-5) |
| 4 | No existe reserva del usuario con `cancelled_at IS NULL AND end_at > now` | 409 `ACTIVE_RESERVATION_EXISTS` (FR-017) |
| 5 | No existe reserva no cancelada para `(court_id, date, start_hour)`; el índice único es la garantía final | 409 `SLOT_TAKEN` (FR-014, FR-015) |

**Estados derivados** (no se guarda columna de estado; se calcula con `now`):

```text
                  cancel (now < start_at, dueño)
   ┌──────────┐ ───────────────────────────────▶ ┌───────────┐
   │ futura   │                                   │ cancelada │  (oculta en Mis Reservas, FR-018;
   │ activa   │                                   └───────────┘   libera el bloque, FR-020)
   └────┬─────┘
        │ now ≥ start_at
        ▼
   ┌──────────┐  now ≥ end_at   ┌──────────┐
   │ en curso │ ──────────────▶ │ pasada   │  (historial)
   │ activa   │                 └──────────┘
   └──────────┘
```

| Estado     | Condición | Cuenta como activa | Lista en "Mis Reservas" | Cancelable |
|------------|-----------|--------------------|-------------------------|------------|
| futura     | `cancelled_at IS NULL AND now < start_at` | Sí | `upcoming` | Sí |
| en curso   | `cancelled_at IS NULL AND start_at ≤ now < end_at` | Sí | `upcoming` (`cancellable: false`) | No (FR-019, escenario US3-6) |
| pasada     | `cancelled_at IS NULL AND now ≥ end_at` | No | `history` | No |
| cancelada  | `cancelled_at IS NOT NULL` | No | ninguna (FR-018) | No |

**Reglas al cancelar** (FR-019, FR-021): `UPDATE reservations SET cancelled_at = :now WHERE id = ?
AND user_id = :currentUser AND cancelled_at IS NULL AND start_at > :now`.
Si 0 filas afectadas: se distingue (en la misma transacción) entre
"no existe / ajena / ya cancelada" → 404 `RESERVATION_NOT_FOUND` y
"ya empezó o pasó" → 400 `RESERVATION_NOT_CANCELLABLE`.

---

## Valor calculado: Bloque horario (no persistido)

Para `(courtId, date)` con `date` dentro de la ventana, se generan 24 bloques `hour = 0..23`:

```text
status(hour) =
  "unavailable"  si slotStartMs(date, hour) <= now           (FR-010, incluye el bloque en curso)
  "reserved"     si existe reserva no cancelada (court, date, hour)
  "available"    en otro caso
```

Una sola consulta: `SELECT start_hour FROM reservations WHERE court_id = ? AND date = ? AND
cancelled_at IS NULL`. La respuesta nunca incluye `user_id` ni datos del dueño (FR-011).
Etiquetas UI: `available` → "Disponible", `reserved` → "Reservado", `unavailable` →
"No disponible".

## Relaciones

```text
users 1 ──── * sessions
users 1 ──── * reservations * ──── 1 courts
login_attempts (independiente; clave = correo normalizado, sin FK a users)
```
