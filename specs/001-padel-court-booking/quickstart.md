# Quickstart / Guía de validación: Reserva de Canchas de Pádel

**Feature**: `specs/001-padel-court-booking` | **Date**: 2026-10-26

Guía para levantar el sistema y comprobar end-to-end que la feature cumple el spec. Contratos:
[contracts/openapi.yaml](./contracts/openapi.yaml), [contracts/ui-routes.md](./contracts/ui-routes.md).
Modelo: [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js ≥ 20 y npm ≥ 10 (`node -v`, `npm -v`).
- Toolchain de compilación para el módulo nativo `better-sqlite3` (normalmente usa binarios
  precompilados; si no: `build-essential` y `python3`).
- `curl` (o Postman CLI, importando `contracts/openapi.yaml`).

## Setup

```bash
npm install            # instala workspaces frontend/ y backend/
npm run db:reset       # borra db/padel.db y aplica db/schema.sql (5 canchas)
npm run dev            # backend en :3000, frontend (Vite) en :5173 con proxy /api → :3000
```

Abrir <http://localhost:5173>.

## Pruebas automatizadas

```bash
npm test                         # backend + frontend (Vitest)
npm test -w backend -- concurrency   # solo SC-001 (50 confirmaciones simultáneas, 20 repeticiones)
```

**Resultado esperado**: todas en verde. La prueba de concurrencia reporta en cada repetición
1 respuesta 201, 49 respuestas 409 `SLOT_TAKEN` y exactamente 1 fila en `reservations`.

## Escenarios de validación (API con curl)

Usar un cookie jar por usuario. `B=http://localhost:3000/api`.

| # | Paso | Esperado | Requisito |
|---|------|----------|-----------|
| 1 | `curl -i $B/courts` | 200, 5 canchas con los nombres exactos y `bookingWindow` de 7 días | FR-007, FR-008 |
| 2 | `curl -i "$B/courts/1/availability?date=<hoy>"` sin cookie | 401 `UNAUTHENTICATED` | FR-005 |
| 3 | `curl -i -c a.txt -H 'Content-Type: application/json' -d '{"email":"Ana@Test.com","password":"secreta123"}' $B/auth/register` | 201 + `Set-Cookie: sid=…; HttpOnly` | FR-001 |
| 4 | Repetir 3 con `ana@test.com` | 409 `EMAIL_TAKEN` | FR-002 |
| 5 | Registro con contraseña `corta` | 400 `INVALID_INPUT` | FR-002 |
| 6 | `curl -b a.txt "$B/courts/1/availability?date=<hoy>"` | 200, 24 slots; los de hora ya iniciada (incluido el en curso) `unavailable` | FR-009, FR-010 |
| 7 | `curl -b a.txt … -d '{"courtId":1,"date":"<mañana>","startHour":18}' $B/reservations` | 201 | FR-012 |
| 8 | Repetir 6 con `<mañana>` | slot 18 `reserved`, sin datos del usuario | FR-010, FR-011 |
| 9 | Con usuario A, reservar otro bloque en cancha 2 | 409 `ACTIVE_RESERVATION_EXISTS` | FR-017 |
| 10 | Registrar usuario B (`b.txt`) y reservar cancha 1, `<mañana>`, 18 | 409 `SLOT_TAKEN` | FR-014, FR-015 |
| 11 | Usuario B: reservar `startHour` de una hora ya pasada de hoy, o una fecha de ayer | 400 `SLOT_IN_PAST` | FR-016 |
| 12 | Usuario B: reservar en `<hoy+7>` | 400 `OUT_OF_BOOKING_WINDOW` | FR-016 |
| 13 | Usuario B: `courtId: 9` o `startHour: 24` o `date: "2026-13-40"` | 400 `INVALID_INPUT` | Edge cases |
| 14 | Usuario A: `curl -b a.txt $B/reservations/me` | `upcoming` con la reserva (cancha, fecha, `18:00–19:00`, `cancellable: true`), `history: []` | FR-018 |
| 15 | Usuario B: `DELETE $B/reservations/<id de A>` | 404 `RESERVATION_NOT_FOUND` | FR-021 |
| 16 | Usuario A: `DELETE $B/reservations/<id>` | 204; repetir 8 → slot 18 `available`; repetir 14 → listas vacías | FR-019, FR-020, FR-018 |
| 17 | Usuario A: repetir 16 | 404 `RESERVATION_NOT_FOUND` | Edge case (otra pestaña) |
| 18 | Usuario A: reservar de nuevo cualquier bloque futuro | 201 (ya no tiene activa) | Edge case |
| 19 | 5 logins con contraseña incorrecta para `ana@test.com` | 1–5: 401 `INVALID_CREDENTIALS` (mismo mensaje que con correo inexistente) | FR-003 |
| 20 | 6.º login con la contraseña **correcta** | 429 `TOO_MANY_ATTEMPTS` + `Retry-After` | FR-003a, SC-005 |
| 21 | Pasos 19–20 con `noexiste@test.com` | Mismas respuestas | FR-003a |
| 22 | `curl -b a.txt -X POST $B/auth/logout`, luego `GET $B/reservations/me` | 204; luego 401 | FR-004 |

Los casos dependientes del reloj (bloqueo de 15 min, expiración de 24 h, reserva en curso que pasa
a historial, confirmación que llega después de la hora de inicio) se validan en las pruebas
automatizadas con reloj inyectado, no manualmente.

## Escenarios de validación (UI)

1. **US1** — Registrarse en `/register` (< 2 min, SC-003); cerrar sesión; entrar a
   `/courts/1` → redirige a `/login`; iniciar sesión → vuelve a `/courts/1`.
2. **US2** — En `/` ver las 5 canchas; abrir una; el selector muestra solo 7 días; la grilla
   muestra 24 bloques con texto "Disponible" / "Reservado" / "No disponible"; reservar un
   bloque con confirmación (< 1 min desde login, SC-002).
3. **Conflicto** — Dos navegadores (o ventana normal + incógnito) con usuarios distintos en la
   misma cancha/fecha; ambos abren el diálogo del mismo bloque; confirmar en el primero y luego
   en el segundo → el segundo ve "La cancha ya fue reservada en este horario" y la grilla
   actualizada.
4. **US3** — En `/my-reservations` ver "Próximas" e "Historial"; pulsar "Cancelar" y luego
   "No" → la reserva sigue; pulsar "Cancelar" y "Sí" → desaparece y el bloque vuelve a
   "Disponible".
5. **Errores** (SC-006) — Detener el backend y realizar una acción → mensaje genérico amigable,
   sin texto técnico.
