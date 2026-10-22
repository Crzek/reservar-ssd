# Feature Specification: Reserva de Canchas de Pádel

**Feature Branch**: `spec`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "./SPEC.md — Autenticación de usuarios con correo y contraseña; exploración de las 5 canchas fijas con grilla de disponibilidad de 24 bloques de 1 hora por fecha; creación de reservas con re-validación anti-colisión; panel 'Mis Reservas' con reservas futuras, historial y cancelación. Fuera de alcance: pagos, panel de administrador, notificaciones externas, reservas de más de 1 hora en un clic, matchmaking."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro e inicio de sesión (Priority: P1)

Un jugador nuevo crea una cuenta con su correo electrónico y una contraseña, y a partir de ese momento puede iniciar y cerrar sesión. Sin sesión activa no puede ver la disponibilidad completa ni reservar.

**Why this priority**: Toda reserva debe estar vinculada a un usuario responsable; sin autenticación no existe ninguna otra funcionalidad del sistema.

**Independent Test**: Registrar una cuenta, cerrar sesión, iniciar sesión con las mismas credenciales y comprobar que se accede a las áreas protegidas; intentar acceder a ellas sin sesión y comprobar que se pide iniciar sesión.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta, **When** se registra con un correo válido no usado y una contraseña que cumple las reglas, **Then** la cuenta se crea y queda con sesión activa.
2. **Given** un correo ya registrado, **When** alguien intenta registrarse con ese mismo correo, **Then** el registro se rechaza con un mensaje claro indicando que el correo ya está en uso.
3. **Given** un usuario registrado, **When** inicia sesión con correo y contraseña correctos, **Then** obtiene una sesión activa y accede al sistema.
4. **Given** un usuario registrado, **When** inicia sesión con una contraseña incorrecta, **Then** el acceso se rechaza con un mensaje genérico que no revela si el correo existe.
5. **Given** un visitante sin sesión, **When** intenta ver la grilla de disponibilidad, reservar o abrir "Mis Reservas", **Then** el sistema le pide iniciar sesión y no muestra ni ejecuta la acción.
6. **Given** un usuario con sesión activa, **When** cierra sesión, **Then** pierde el acceso a las áreas protegidas hasta volver a iniciar sesión.

---

### User Story 2 - Consultar disponibilidad y reservar un bloque (Priority: P1)

Un usuario autenticado elige una de las 5 canchas, selecciona una fecha en el calendario, ve la grilla de 24 bloques de 1 hora con su estado ("Disponible" / "Reservado") y confirma la reserva de un bloque disponible.

**Why this priority**: Es el valor central del producto: reservar una cancha sin conflictos.

**Independent Test**: Con un usuario sin reservas activas, seleccionar cancha y fecha futura, reservar un bloque disponible y comprobar que el bloque pasa a "Reservado" para todos los usuarios.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión, **When** abre la vista de canchas, **Then** ve exactamente las 5 canchas: Cancha Laureles, Cancha El Poblado, Cancha Belén, Cancha Robledo y Cancha Envigado.
2. **Given** un usuario que eligió una cancha y una fecha, **When** se muestra la grilla, **Then** aparecen 24 bloques (00:00–01:00 hasta 23:00–24:00), cada uno marcado claramente como "Disponible" o "Reservado".
3. **Given** un bloque "Disponible" en el futuro y un usuario sin reserva activa, **When** el usuario lo selecciona y confirma, **Then** la reserva se crea y el bloque aparece como "Reservado".
4. **Given** dos usuarios que ven el mismo bloque como "Disponible", **When** ambos confirman y el primero completa la reserva antes, **Then** la reserva del segundo se rechaza con un mensaje claro (p. ej. "La cancha ya fue reservada en este horario") y la grilla se actualiza.
5. **Given** un bloque cuya hora de inicio ya pasó (o una fecha pasada), **When** el usuario intenta reservarlo, **Then** el sistema no lo permite e indica que no se puede reservar en el pasado.
6. **Given** un usuario que ya tiene una reserva activa, **When** intenta confirmar otra reserva en cualquier cancha, **Then** el sistema la rechaza con un mensaje claro indicando que solo se permite una reserva activa a la vez.

---

### User Story 3 - Gestionar "Mis Reservas" (Priority: P2)

Un usuario autenticado abre su panel y ve su reserva futura y su historial de reservas pasadas; puede cancelar una reserva futura tras confirmar la acción.

**Why this priority**: Da control al usuario sobre sus reservas y libera bloques que no se van a usar, pero el sistema ya entrega valor sin él.

**Independent Test**: Con un usuario que tiene una reserva futura y al menos una pasada, abrir el panel, verificar ambas listas, cancelar la futura y comprobar que desaparece de la lista y que el bloque vuelve a estar "Disponible".

**Acceptance Scenarios**:

1. **Given** un usuario con reservas, **When** abre "Mis Reservas", **Then** ve separadas las reservas futuras y el historial de reservas pasadas, y cada ítem muestra nombre de la cancha, fecha y hora.
2. **Given** un usuario sin reservas, **When** abre "Mis Reservas", **Then** ve un mensaje indicando que no tiene reservas.
3. **Given** una reserva futura, **When** el usuario selecciona "Cancelar" y confirma, **Then** la reserva se cancela, deja de aparecer en la lista y el bloque vuelve a mostrarse "Disponible" para todos.
4. **Given** una reserva futura, **When** el usuario selecciona "Cancelar" pero no confirma, **Then** la reserva permanece intacta.
5. **Given** una reserva que pertenece a otro usuario, **When** un usuario intenta verla o cancelarla, **Then** el sistema lo impide.
6. **Given** una reserva pasada o ya en curso, **When** el usuario la consulta, **Then** no se ofrece la opción de cancelarla.

---

### Edge Cases

- Un usuario selecciona la fecha de hoy: los bloques cuya hora de inicio ya pasó (incluido el bloque en curso) se muestran como no reservables.
- Dos usuarios confirman el mismo bloque prácticamente al mismo tiempo: exactamente una reserva se crea; la otra se rechaza con el mensaje de conflicto.
- Un usuario abre la confirmación de reserva, la deja abierta hasta que la hora de inicio pasa y luego confirma: la reserva se rechaza por ser en el pasado.
- Un usuario con una reserva activa la cancela: inmediatamente puede hacer una nueva reserva.
- Cuando la hora de fin de la reserva activa de un usuario pasa, esta pasa al historial y el usuario puede volver a reservar.
- Un usuario intenta cancelar una reserva que ya fue cancelada (p. ej. desde otra pestaña): el sistema informa que la reserva ya no existe o ya fue cancelada.
- La sesión del usuario expira mientras confirma una reserva: la acción no se ejecuta y se le pide iniciar sesión de nuevo.
- Se envían datos inválidos (cancha inexistente, bloque que no empieza en hora en punto, fecha mal formada): el sistema los rechaza con un mensaje claro y no crea nada.
- El último bloque del día (23:00–24:00) termina a medianoche y se trata como un bloque normal de la fecha seleccionada.

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación**

- **FR-001**: El sistema MUST permitir registrarse con un correo electrónico y una contraseña.
- **FR-002**: El sistema MUST rechazar el registro si el correo tiene un formato inválido, ya está registrado (sin distinguir mayúsculas/minúsculas) o la contraseña tiene menos de 8 caracteres.
- **FR-003**: El sistema MUST permitir iniciar sesión con correo y contraseña y MUST rechazar credenciales incorrectas con un mensaje genérico que no revele si el correo existe.
- **FR-004**: El sistema MUST permitir cerrar sesión.
- **FR-005**: El sistema MUST exigir una sesión activa para ver la grilla de disponibilidad, crear reservas, consultar "Mis Reservas" y cancelar reservas; sin sesión, MUST bloquear la acción y pedir iniciar sesión.
- **FR-006**: El sistema MUST almacenar las contraseñas de forma que no puedan recuperarse en texto plano.

**Canchas y disponibilidad**

- **FR-007**: El sistema MUST listar exactamente 5 canchas fijas: Cancha Laureles, Cancha El Poblado, Cancha Belén, Cancha Robledo y Cancha Envigado. MUST NOT existir forma de crear, editar ni eliminar canchas.
- **FR-008**: El usuario MUST poder seleccionar una fecha en un calendario para la cancha elegida.
- **FR-009**: Para la cancha y fecha seleccionadas, el sistema MUST mostrar 24 bloques de 1 hora (00:00–01:00 … 23:00–24:00) en formato de 24 horas.
- **FR-010**: Cada bloque MUST indicar claramente si está "Disponible" o "Reservado"; los bloques cuya hora de inicio ya pasó MUST mostrarse como no reservables.
- **FR-011**: La grilla MUST NOT revelar qué usuario tiene reservado un bloque.

**Creación de reservas**

- **FR-012**: El usuario MUST poder seleccionar un bloque disponible y confirmar su reserva.
- **FR-013**: Cada reserva MUST cubrir exactamente un bloque entero de 1 hora que comienza en hora en punto.
- **FR-014**: Al confirmar, el sistema MUST re-validar que el bloque siga disponible y crear la reserva como una única operación indivisible, de modo que dos confirmaciones simultáneas sobre el mismo bloque nunca produzcan dos reservas.
- **FR-015**: Si el bloque ya fue tomado, el sistema MUST rechazar la reserva con un mensaje claro (p. ej. "La cancha ya fue reservada en este horario") y MUST mostrar el estado actualizado.
- **FR-016**: El sistema MUST rechazar reservas en fechas pasadas o en bloques cuya hora de inicio ya transcurrió, evaluado en el momento de la confirmación.
- **FR-017**: El sistema MUST rechazar una nueva reserva si el usuario ya tiene una reserva activa, informándolo con un mensaje claro.

**Mis Reservas**

- **FR-018**: El usuario MUST tener un panel "Mis Reservas" que muestre por separado sus reservas futuras y su historial de reservas pasadas, cada ítem con nombre de la cancha, fecha y hora.
- **FR-019**: El usuario MUST poder cancelar una reserva futura (cuya hora de inicio no ha llegado) seleccionándola y confirmando la acción; sin confirmación no se cancela.
- **FR-020**: Al cancelarse una reserva, el bloque MUST volver a mostrarse "Disponible" para todos los usuarios y la reserva MUST dejar de contar como activa.
- **FR-021**: Un usuario MUST poder ver y cancelar únicamente sus propias reservas.

**Errores**

- **FR-022**: Todo error MUST presentarse al usuario como un mensaje comprensible y accionable; nunca se muestran detalles técnicos.
- **FR-023**: El sistema MUST distinguir en sus respuestas entre solicitud inválida, falta de autenticación y conflicto de reserva, para que cada caso muestre el mensaje adecuado.

**Fuera de alcance (esta iteración)**

- **FR-024**: El sistema MUST NOT incluir pagos en línea, panel de administración de canchas, notificaciones externas (correo, SMS, WhatsApp), reservas de más de 1 hora en una sola acción, ni matchmaking/torneos.

### Key Entities

- **Usuario**: Persona registrada. Atributos: correo electrónico (único), credencial de acceso protegida, fecha de registro. Tiene cero o más reservas.
- **Cancha**: Una de las 5 canchas fijas. Atributo: nombre. Inmutable.
- **Reserva**: Vínculo entre un usuario, una cancha, una fecha y un bloque de 1 hora (hora de inicio). Estado: activa (futura o en curso), pasada o cancelada. Para una misma cancha, fecha y hora solo puede existir una reserva no cancelada.
- **Bloque horario**: Intervalo de 1 hora dentro de una fecha (24 por día) cuyo estado para una cancha se deriva de si existe una reserva no cancelada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En pruebas de concurrencia con 50 confirmaciones simultáneas sobre el mismo bloque, se crea exactamente 1 reserva y las 49 restantes reciben el mensaje de conflicto (0 reservas duplicadas en el 100% de las ejecuciones).
- **SC-002**: Un usuario registrado puede ir desde el inicio de sesión hasta una reserva confirmada en menos de 1 minuto.
- **SC-003**: Un usuario nuevo completa el registro en menos de 2 minutos.
- **SC-004**: La grilla de disponibilidad de una cancha y fecha se muestra en menos de 2 segundos en el 95% de las consultas.
- **SC-005**: El 100% de los intentos de reservar en el pasado, de tener más de una reserva activa o de actuar sobre reservas ajenas son rechazados.
- **SC-006**: El 100% de los mensajes de error mostrados al usuario están en lenguaje comprensible, sin detalles técnicos.
- **SC-007**: El 90% de los usuarios de prueba logran reservar y cancelar una reserva en su primer intento sin ayuda.

## Assumptions

- Todas las fechas y horas se interpretan en la hora local del club (Medellín, Colombia, UTC−5); "pasado" se evalúa contra la hora actual del servidor en esa zona.
- "Reserva activa" significa una reserva no cancelada cuya hora de fin aún no ha pasado (futura o en curso); al terminar su hora pasa al historial.
- Los visitantes sin sesión pueden ver la lista de las 5 canchas, pero no la grilla de disponibilidad.
- Las canchas están disponibles las 24 horas, todos los días; no hay cierres, mantenimientos ni horarios restringidos en esta iteración.
- No hay límite máximo de antelación para reservar fechas futuras en esta iteración.
- Se puede cancelar una reserva en cualquier momento antes de su hora de inicio, sin penalización; una reserva en curso o pasada no se puede cancelar.
- Las reservas canceladas no se muestran en el historial; el historial contiene solo reservas cuya hora ya transcurrió.
- No hay recuperación de contraseña, verificación de correo ni edición de perfil en esta iteración.
- La sesión se mantiene hasta que el usuario cierra sesión o expira por inactividad según una duración estándar.
- El pago se realiza presencialmente en el club, fuera del sistema.
