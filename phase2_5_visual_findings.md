# Fase 2.5 — Hallazgos visuales

La captura desktop muestra el nuevo shell con sidebar más delgado, navbar flotante con blur selectivo, fondo institucional suave, jerarquía tipográfica clara y cards con profundidad contenida. El dashboard conserva el orden de lectura: encabezado, acción principal, métricas, alertas, EduCore AI y actividad reciente.

La captura mobile a 375×812 muestra el header compacto con menú y notificaciones, cards apiladas, CTA táctil de ancho completo y navegación inferior fija con cuatro accesos principales. La navegación no requiere reducir el sidebar desktop y mantiene una interacción de aplicación móvil.

La captura full-page confirma que EduCore AI continúa destacado como capacidad institucional y que comunicaciones y actividad permanecen accesibles debajo del bloque de atención.

## Validación live adicional

El login conserva el flujo demo y ahora muestra el escudo institucional almacenado en `/manus-storage/`. El acceso admin abre correctamente el dashboard sin errores; el sidebar muestra el escudo, la navbar flotante, la acción principal, métricas, alertas, EduCore AI, comunicaciones y actividad reciente. Las funcionalidades existentes y la identidad institucional siguen visibles.

## Corrección de asset

Se detectó y corrigió una ruta de logo con espacios/paréntesis. El helper `storageUrl` ahora codifica cada segmento del path de storage, y el escudo vuelve a cargar correctamente en login, sidebar y configuración. El recurso sigue viniendo de storage; no se movieron bytes a la base de datos.

## Regresión desktop — primer bloque

Login carga con escudo desde storage y ofrece las cuatro demos. El dashboard admin conserva métricas, alertas, CTA, comunicaciones y actividad. Classroom abre correctamente y muestra tareas, estados, entregas, fechas y acciones existentes con el nuevo tratamiento de cards.

## Regresión desktop — segundo bloque

Académico carga cursos, tabs de Cursos/Estudiantes/Calificaciones y búsqueda. Asistencia carga selector de curso, lista de estudiantes, botones Presente/Ausente/Tardanza/Excusa, guardado y resumen porcentual. El styling nuevo no interfiere con controles ni datos.

## Regresión desktop — tercer bloque

Calendario carga mes, semana, eventos próximos y navegación anterior/siguiente. Comunicaciones carga contadores, audiencia y comunicados publicados/borradores. Reportes carga barras por curso, lectura asistida, estudiantes con dificultades y boletines. La vista docente también carga saludo, métricas, agenda, pendientes y CTA EduCore AI.

## Regresión por roles

La vista estudiante carga dashboard con promedio, asistencia, tareas, calificaciones y acceso contextual a EduCore AI. Classroom filtra a tareas del estudiante y cambia acciones a Ver entrega/Entregar según estado. EduCore AI carga sugerencias de tareas, semana y asistencia, manteniendo el mensaje de revisión humana y el contexto de rol.

## Regresión final y responsive

La vista acudiente carga resumen familiar, selector de Sofía, métricas, semana, calificaciones y EduCore AI. La captura mobile explícita a 375×812 confirma header compacto, CTA táctil de ancho completo, cards verticales con espacios generosos y navegación inferior flotante con Inicio, Académico, Classroom y Asistencia. Los breakpoints se comportan como aplicación mobile, no como desktop comprimido.
