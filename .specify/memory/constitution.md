<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles (placeholder → new title):
  - [PRINCIPLE_1_NAME] → I. Prevención de Colisiones de Reservas (NO NEGOCIABLE)
  - [PRINCIPLE_2_NAME] → II. Dominio Cerrado y Autenticación Obligatoria
  - [PRINCIPLE_3_NAME] → III. Simplicidad y Estructura Plana
  - [PRINCIPLE_4_NAME] → IV. TypeScript y Estilo Funcional
  - [PRINCIPLE_5_NAME] → V. Errores Amigables y HTTP Semántico
  - (added) VI. Cero Código Sombra (Spec como Fuente de la Verdad)
- Added sections: Stack Tecnológico; Flujo de Trabajo SDD y Comportamiento del Agente
- Removed sections: none
- Source: ./constitution.md (Constitución del Proyecto: Sistema de Reservas de Pádel)
- Follow-up TODOs: none. RATIFICATION_DATE set to 2026-10-22 (first adoption into
  .specify/memory); adjust if the project adopted ./constitution.md on an earlier date.
-->

# Sistema de Reservas de Pádel Constitution

Aplicación para la reserva de canchas de pádel. Su propósito es permitir a los usuarios
autenticarse y gestionar reservas de tiempo en canchas específicas.

## Core Principles

### I. Prevención de Colisiones de Reservas (NO NEGOCIABLE)

- Ninguna reserva PUEDE escribirse en la base de datos sin validar primero que la cancha
  seleccionada esté libre en ese horario.
- La validación de disponibilidad y la inserción DEBEN ejecutarse de forma atómica (misma
  transacción SQLite) para que dos solicitudes concurrentes no puedan reservar el mismo bloque.
- Un intento de reservar un bloque ocupado DEBE rechazarse con HTTP 409.

**Rationale**: El double-booking es la falla crítica del sistema; cualquier otra regla
cede ante esta.

### II. Dominio Cerrado y Autenticación Obligatoria

- El sistema SOLO maneja 5 canchas fijas: Cancha Laureles, Cancha El Poblado, Cancha Belén,
  Cancha Robledo y Cancha Envigado. NO se permite crear, editar ni eliminar canchas.
- Las reservas operan en formato de 24 horas.
- Todo flujo de reserva (crear, consultar las propias, cancelar) EXIGE un usuario con sesión
  activa; las solicitudes sin sesión DEBEN responder HTTP 401.

**Rationale**: Un catálogo fijo y reglas de horario explícitas eliminan ambigüedad; la
autenticación vincula cada reserva a un responsable.

### III. Simplicidad y Estructura Plana

- La estructura del repositorio DEBE ser plana: `/frontend`, `/backend` y `/db`.
- NO se implementa Clean Architecture, capas de repositorio/servicio abstractas ni patrones
  complejos sin una justificación documentada en el plan.
- NO se usan ORMs pesados; el acceso a datos se hace con `better-sqlite3` o SQL puro.

**Rationale**: Es una aplicación pequeña; la sobreingeniería añade costo sin beneficio.

### IV. TypeScript y Estilo Funcional

- TODO el stack (frontend y backend) DEBE escribirse en TypeScript.
- Se priorizan funciones puras y componentes funcionales con Hooks en React. Las clases NO se
  usan salvo que una librería lo exija.
- Nomenclatura: `camelCase` para funciones y variables; `PascalCase` para interfaces, tipos y
  componentes React.

**Rationale**: Tipado consistente y un único estilo reducen errores y facilitan la revisión.

### V. Errores Amigables y HTTP Semántico

- La UI NUNCA expone errores crudos ni stack traces al usuario final; todo error técnico DEBE
  traducirse a un mensaje amigable (ej.: "La cancha ya fue reservada en este horario").
- El backend DEBE retornar códigos HTTP semánticos: 400 (petición inválida), 401 (no
  autenticado), 409 (conflicto de reserva).

**Rationale**: El usuario necesita mensajes accionables; el cliente necesita códigos
predecibles para mapearlos a esos mensajes.

### VI. Cero Código Sombra (Spec como Fuente de la Verdad)

- Se construye estrictamente lo documentado en `spec.md`. NO se añaden características
  "por si acaso" (pasarelas de pago, perfiles complejos, etc.).
- Toda funcionalidad implementada DEBE poder trazarse a un requisito del spec.

**Rationale**: Mantiene el alcance controlado y verificable en el flujo SDD.

## Stack Tecnológico

- **Frontend / UI**: React con Tailwind CSS para estilos.
- **Backend**: Node.js con Express.
- **Base de Datos**: SQLite local (archivo `padel.db`) vía `better-sqlite3` o SQL puro.
- **Lenguaje**: TypeScript en todo el stack.

Cambiar cualquier elemento del stack requiere una enmienda a esta constitución.

## Flujo de Trabajo SDD y Comportamiento del Agente

- Si una instrucción del usuario contradice esta constitución, o se detecta una falla lógica en
  el spec, el agente DEBE detenerse, advertir del problema y solicitar actualizar `spec.md`
  antes de tocar el código fuente.
- Los cambios de alcance se hacen primero en `spec.md` (`/speckit-specify`, `/speckit-clarify`)
  y luego se propagan a plan y tareas; nunca directamente en el código.
- El Constitution Check de cada `plan.md` DEBE verificar los principios I–VI.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica, plan o instrucción ad hoc.
- Enmiendas: se proponen como cambio a `.specify/memory/constitution.md`, con el Sync Impact
  Report actualizado y aprobación explícita del responsable del proyecto.
- Versionado semántico: MAJOR para eliminar o redefinir principios; MINOR para añadir
  principios o secciones o ampliar materialmente una guía; PATCH para aclaraciones de redacción.
- Cumplimiento: cada plan, revisión de código y tarea DEBE verificar el cumplimiento; toda
  excepción a la Simplicidad (III) DEBE justificarse por escrito en el plan.

**Version**: 1.0.0 | **Ratified**: 2026-10-22 | **Last Amended**: 2026-10-22
