# EduCore — Fase 4: Arquitectura académica

## Objetivo

Convertir la sección Académico en una fuente de verdad persistente para años, periodos, grados, cursos, materias, asignaciones docentes y matrículas, manteniendo aislamiento por institución y permisos server-side.

## Entregables

- [x] Extender schema con `academic_years`, grados, relaciones curso-materia, asignaciones docentes y matrículas con historial.
- [x] Sembrar datos académicos demo para 2025/2026, grados 6°–11°, cursos, materias, asignaciones y estudiantes.
- [x] Implementar snapshot académico filtrado por `school_id` y rol: admin, docente, estudiante y acudiente.
- [x] Implementar creación de año, grado, curso y materia con validación institucional.
- [x] Implementar asociación materia-curso y asignación docente.
- [x] Implementar matrícula individual/masiva, prevención de duplicados y cambio de curso con historial.
- [x] Conectar tRPC y reemplazar el placeholder de Académico por tabs de Resumen, Cursos, Materias, Docentes, Estudiantes y Matrículas.
- [x] Agregar formularios premium para curso y materia, selección masiva y cambio de curso.
- [x] Mantener RBAC server-side: solo administradores gestionan estructura; docentes, estudiantes y acudientes reciben contexto filtrado.
- [x] Agregar 18 pruebas académicas de estructura, relaciones, permisos, aislamiento, matrícula e historial.

## Verificación

- `pnpm check`: correcto.
- `pnpm test`: 4 archivos, 42 pruebas correctas.
- `pnpm build`: correcto; queda únicamente el warning informativo de chunk Vite grande.
- Preview live: login admin, Académico, Resumen, Cursos y Matrículas verificados; snapshot cargó 10 cursos, 5 materias, 6 grados y matrículas activas.
- Preview responsive: shell Spatial y tarjetas institucionales conservan composición limpia.
- Datos QA temporales: comprobados y limpiados por los hooks de las pruebas; se preservan las identidades y datos demo.

## Fuera de alcance

El envío de notificaciones, carga masiva CSV, edición avanzada de periodos y vistas analíticas específicas por materia quedan preparados para la siguiente fase; no se presentan como funcionalidades falsas.
