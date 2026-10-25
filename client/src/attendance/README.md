# Módulo Asistencia de EduCore

El módulo ofrece una experiencia docente de pase de lista con estética **Chrona Glass**. Es autocontenido y no incorpora servicios de datos, rutas externas ni perfiles de ejemplo: el host inyecta cursos, estados y callbacks a través de contratos tipados.

## Experiencia

La planilla tiene tres superficies: **encabezado** (curso, horario, fecha, estado de la clase y guardado), **avance del día** (registrados, conteos P/A/T/E y la única acción masiva, "Marcar restantes presentes", que nunca sobrescribe registros ya hechos) y **planilla** (vistas Todos · Por registrar · Ausentes · Con alertas, búsqueda, deshacer, Enfocar y ayuda, sobre el roster). Cada fila muestra estudiante con su alerta principal, control P/A/T/E e historial (últimas 8 jornadas + % histórico). Mantiene navegación de teclado, pila de deshacer de 24 acciones, autosave serializado, resumen individual con ficha personal/familiar y señales explicables, y modo **Enfocar asistencia** a pantalla completa.

El panel y el selector respetan el tema claro/oscuro y `prefers-reduced-motion`. El host puede apartar su navegación durante el modo de concentración mediante `onFocusModeChange`.

## Estructura

| Archivo / carpeta | Responsabilidad |
| --- | --- |
| `landing/` | Portada docente (diseño EduCore Docente): resumen del periodo, clases de hoy, justificaciones por revisar y próximas clases. `landing.ts` es el modelo de presentación puro, con pruebas. |
| `AttendancePanel.tsx` | Orquestador del panel docente y su sesión local. |
| `components/AttendanceHeader.tsx` | Encabezado: curso, horario, fecha, estado de la clase, sincronización y regreso al selector. |
| `components/DayProgress.tsx` | Avance del día, conteos semánticos y acción "Marcar restantes presentes". |
| `components/AttendanceToolbar.tsx` + `FilterChips.tsx` | Vistas del roster, búsqueda, deshacer, Enfocar y ayuda. |
| `components/AttendanceSheet.tsx` | Roster con encabezado sticky y estructura ARIA de grilla. |
| `components/StudentRow.tsx` + `StatusCell.tsx` | Registro por estudiante, estados P/A/T/E e historial visual. |
| `components/StudentPopover.tsx` | Popover contextual Liquid Glass. |
| `components/StudentExpediente.tsx` | Resumen docente individual; delega las vistas completas del host mediante callbacks. |
| `components/SyncIndicator.tsx` | Estados de sincronización y reintento. |
| `hooks/useAttendanceSession.ts` | Jornada por curso/fecha, deshacer y autosave serializado. |
| `hooks/useAttendanceHotkeys.ts` | Atajos del pase de lista. |
| `data/selectors.ts` | Métricas, filtros, tendencia y reglas explicables. |
| `data/dateUtils.ts` | Conversión neutral entre fechas locales e ISO. |
| `statusMeta.ts`, `format.ts`, `types.ts` | Metadatos, formato es-CO y contratos públicos. |
| `index.ts` | Exportaciones públicas del módulo. |

## Conexión a EduCore Main

Importa la API pública y adapta los datos existentes a `Course`, `Student`, `AttendanceRecord` y `SessionStatuses`:

```tsx
import { AttendanceLanding, AttendancePanel } from "@/features/attendance";

<AttendanceLanding
  courses={cursosDelDocente}
  statusesByCourse={registrosDeHoyPorCurso}
  justifications={justificaciones}
  periods={periodosAcademicos}
  onOpenSession={(courseId, date, filter) => abrirPlanilla(courseId, date, filter)}
  onReviewJustification={(courseId, id) => abrirRevisionExistente(courseId, id)}
/>;

<AttendancePanel
  courses={cursosDelDocente}
  initialCourseId={cursoActivo}
  initialDate={fechaActiva}
  initialStatuses={registrosDeLaJornada}
  onPersist={async ({ courseId, date, statuses }) => {
    await api.asistencia.guardar({ courseId, date, statuses });
  }}
  onBackToCourses={() => volverAlSelectorInterno()}
  onOpenExpediente={student => abrirExpediente360(student.id)}
  onOpenHistory={student => abrirHistorial(student.id)}
  onOpenFollowUp={student => abrirSeguimiento(student.id)}
  getStudentSummaryProfile={student => perfilesPersonales[student.id]}
  onFocusModeChange={focused => setNavegacionInert(focused)}
/>;
```

El shell anfitrión debe mostrar **una única entrada global** para Asistencia. El selector y el panel son vistas internas; `onBackToCourses` vuelve al selector sin cambiar la ruta. `AttendancePage.tsx` es el adaptador del entorno local: sus props opcionales aceptan los mismos datos reales y, si no se suministran, muestra un estado vacío sin inventar cursos, métricas ni perfiles. Para revisar visualmente la tarjeta, `App.tsx` inyecta el salón de muestra **11-2** sin estudiantes ni registros; este dato no pertenece al módulo exportable ni a la integración real.

### Contratos y datos

- `courses`, `statusesByCourse` y `justifications` son valores de entrada del host; la portada no hace consultas ni conserva fixtures.
- Una clase de hoy queda “Lista tomada” cuando no hay pendientes, “En curso” durante su horario y “Lista pendiente” si terminó sin lista completa; en esos dos últimos casos la acción principal es “Tomar lista”. Un reloj por minuto mantiene el estado al día.
- “Con alertas” cuenta estudiantes con ausencias consecutivas o asistencia baja; la alerta de una clase abre la planilla con el filtro de atención docente (`initialFilter`).
- “Asistencia del periodo” usa el histórico dentro de las fechas del periodo activo (si cubren hoy) más la jornada de hoy; sin registros muestra “Sin registros aún”.
- `initialStatuses` representa la jornada abierta al montar el panel. El host adapta la respuesta de su API a `SessionStatuses` y la pasa con curso y fecha.
- `onPersist` recibe la instantánea inmutable `{ courseId, date, statuses }`. Los guardados se serializan y una respuesta obsoleta no marca como guardada una edición posterior; un rechazo activa el estado de error y el reintento. Si se omite, los cambios permanecen en la sesión local y el indicador no afirma que se guardaron en EduCore.
- `onOpenExpediente`, `onOpenHistory` y `onOpenFollowUp` delegan a las vistas ya existentes en EduCore Main. Sin callback, las acciones correspondientes quedan deshabilitadas o se muestra el resumen docente local.
- `getStudentSummaryProfile` puede proporcionar `studentCode`, `guardianPhone` y `guardianEmail`. `Student.guardian` y los conteos de solicitudes/excusas deben proceder de EduCore; el módulo no inventa datos familiares ni crea flujos documentales.

## Sesión y reglas de negocio

La sesión se identifica por el par **curso + fecha**. Cada jornada mantiene estados y sincronización separados. Al cambiar de jornada, los estados precargados no se mezclan y se reinicia la pila de deshacer; regresar a una jornada editada conserva su sesión local mientras siga montado el módulo.

Las fechas iniciales y valores por defecto usan la fecha local actual mediante `dateUtils.ts`; no hay una fecha fija de fixture. Sin registros históricos, la tasa individual no muestra un porcentaje. Las reglas de atención se centralizan en `data/selectors.ts`:

- 3 ausencias consecutivas.
- Asistencia menor a 85%.
- 3 tardanzas dentro de los últimos 15 registros históricos.
- Excusa pendiente de revisión.

Ajusta esos umbrales en un solo lugar si el modelo real de EduCore usa otros criterios. Las explicaciones solo utilizan el historial y contadores recibidos.

## Tema, accesibilidad y teclado

El módulo consume tokens CSS del host (`--surface-*`, `--hairline`, `--glass-bg`, `--brand*` y estados `--st-*`). Al integrarlo, copia o mapea los bloques de tema claro y `.dark` de `client/src/index.css` a la paleta real. Los tokens de acento se establecen con `data-accent` en `<html>`.

Atajos: `P` presente · `A` ausente · `T` tardanza · `E` excusa · `Enter` presente · `Supr`/`⌫` pendiente · `↑`/`↓` estudiante anterior/siguiente · `Tab`/`⇧Tab` recorrer la planilla · `/` buscar · `?` ayuda · `Ctrl`/`⌘ + Z` deshacer. Los atajos de registro actúan con el foco en la planilla; `/` y `?` funcionan en todo el panel. No se disparan al escribir, quedan inactivos si hay un popover, menú o diálogo abierto, y `Enter` sobre un botón conserva su acción nativa. Al registrar un pendiente, el foco avanza al siguiente estudiante.

El popover usa una sola referencia `PopoverTrigger` por fila para conservar su anclaje y retorno de foco. `AttendanceSheet`, `StudentRow` y `StudentPopover` mantienen memorias por estudiante para reducir renders al cambiar rápidamente de fila. Respeta `prefers-reduced-motion` y conserva los tokens semánticos de asistencia.
