# UI Contract: Rutas y pantallas

**Feature**: `specs/001-padel-court-booking` | **Date**: 2026-10-26

| Ruta | Pantalla | Sesión | Endpoints | Requisitos |
|------|----------|--------|-----------|------------|
| `/login` | Inicio de sesión | No | `POST /api/auth/login` | FR-003, FR-003a, US1-3/4/7 |
| `/register` | Registro | No | `POST /api/auth/register` | FR-001, FR-002, US1-1/2 |
| `/` | Lista de las 5 canchas | No (lista pública) | `GET /api/courts` | FR-007, US2-1 |
| `/courts/:courtId` | Selector de 7 días + grilla de 24 bloques + confirmación | Sí | `GET /api/courts/:id/availability`, `POST /api/reservations` | FR-008–FR-017, US2-2..7 |
| `/my-reservations` | "Mis Reservas": próximas + historial, cancelar con confirmación | Sí | `GET /api/reservations/me`, `DELETE /api/reservations/:id` | FR-018–FR-021, US3 |

## Comportamiento común

- **Rutas protegidas**: si `GET /api/auth/me` o cualquier llamada responde 401, se redirige a
  `/login?next=<ruta>` con el mensaje "Tu sesión expiró o no has iniciado sesión" (FR-005,
  FR-004a). Tras iniciar sesión se vuelve a `next`.
- **Lista de canchas sin sesión**: cada cancha muestra "Inicia sesión para ver disponibilidad"
  en lugar del enlace a la grilla.
- **Grilla** (`SlotGrid`): 24 celdas `HH:00–HH+1:00` (formato 24 h). Estados con texto + color
  (no solo color): "Disponible" (seleccionable), "Reservado", "No disponible" (deshabilitados).
- **Selector de fecha** (`DayPicker`): solo los 7 días de `bookingWindow`; hoy seleccionado por
  defecto.
- **Confirmación de reserva**: diálogo "Reservar {cancha} el {fecha} de {hora}" →
  Confirmar / Cancelar. Tras éxito o cualquier 409 se recarga la grilla.
- **Cancelación**: botón "Cancelar" solo si `cancellable === true`; diálogo de confirmación
  obligatorio; tras éxito se recarga la lista.
- **Errores**: el cliente muestra el mensaje según `error.code` desde un catálogo local en
  español; si el código es desconocido o la red falla: "Ocurrió un problema. Inténtalo de nuevo."
  Nunca se muestra `message` técnico, stack trace ni código HTTP (FR-022, Principio V).
- **Vacío**: "Mis Reservas" sin elementos muestra "Aún no tienes reservas" (US3-2).
