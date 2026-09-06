# EduCore — Fase 3: Identidad, roles y relaciones institucionales

## Objetivo

Construir sobre la aplicación existente una base de identidad escolar estructurada: institución, usuario, membresía, rol, permisos y relaciones académicas. Se preservan los dashboards, datos demo, branding dinámico, `school_id`, persistencia y lógica de EduCore AI.

## Implementación

- [x] Extender schema con memberships, roles, permisos, perfiles, relaciones e invitaciones.
- [x] Implementar autorización backend, aislamiento por `school_id` y estados de usuario.
- [x] Asignar datos demo a identidades y memberships ficticias.
- [x] Construir UI Spatial para usuarios, perfiles, invitaciones, relaciones y permisos.
- [x] Agregar pruebas Vitest de creación, permisos, suspensión, invitaciones, relaciones, aislamiento, último admin y resistencia a role spoofing.
- [x] Ejecutar migración, typecheck, tests, build y regresión visual.

## Implementado vs preparado

La administración básica de usuarios, invitaciones de desarrollo, perfiles, relaciones acudiente-estudiante, permisos explícitos y controles RBAC quedó implementada. El envío real de correo, recuperación de contraseña, selección de múltiples instituciones y módulos académicos completos quedan preparados para fases posteriores; no se simulan como funciones reales.

## Restricciones verificadas

No se reconstruyó la aplicación ni se duplicó la tabla de usuarios. No se eliminaron datos existentes. Las mutaciones relevantes resuelven permisos server-side a partir de la membresía; las sesiones reales bloquean usuarios suspendidos o inactivos. Las invitaciones no exponen tokens después de crearse. La suspensión conserva el historial y se protege el último administrador funcional. Las queries de identidad filtran por `school_id`.

## Verificación final

- `pnpm check`: correcto.
- `pnpm test`: 3 archivos, 24 pruebas correctas.
- `pnpm build`: correcto; solo queda el warning informativo de chunk Vite mayor a 500 kB.
- Preview live: login admin, Usuarios, modal de crear usuario, Roles y permisos, Invitaciones y selector de dos estudiantes vinculados en vista acudiente verificados.
