# EduCore — Fase 2.5

## Alcance

- Refinar visualmente EduCore hacia una experiencia premium, minimalista y editorial.
- Aplicar el lenguaje **EduCore Spatial UI**: superficies limpias, profundidad sutil, blur controlado, cards flotantes y motion breve.
- Mantener branding dinámico por institución, `school_id`, datos demo, roles, dashboards y módulos existentes.
- No cambiar la lógica de EduCore AI ni agregar funcionalidades grandes.

## Entregables

- [x] Tokens visuales y fondos institucionales refinados.
- [x] Sidebar delgado, navbar flotante y navegación mobile apropiada.
- [x] Composición editorial para dashboards y cards con jerarquías distintas.
- [x] Login, EduCore AI y configuración alineados al nuevo lenguaje.
- [x] Transiciones, hover, focus y estados accesibles.
- [x] Validación desktop/mobile y regresión funcional.
- [x] Typecheck, Vitest y build de producción.
- [x] Regresión manual de login, dashboards rector/docente/estudiante/acudiente, Classroom, Académico, Asistencia, Calendario, Comunicaciones, Reportes, EduCore AI y Configuración.
- [x] Verificación responsive con viewport mobile explícito y navegación inferior.
- [x] Hallazgos documentados en `phase2_5_visual_findings.md`.

## Restricciones

- No eliminar módulos, datos, permisos, persistencia ni branding de Fase 2.
- No usar glassmorphism de forma indiscriminada.
- No introducir colores hardcoded que sustituyan los tokens institucionales.
- No cargar assets pesados por estética.
