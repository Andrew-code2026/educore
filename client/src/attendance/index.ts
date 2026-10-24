/**
 * API pública del módulo Panel de Asistencia.
 *
 * Al exportarlo al proyecto principal de EduCore, importa desde aquí:
 *   import { AttendancePanel } from "@/features/attendance";
 * e inyecta cursos, estados y callbacks de persistencia del host.
 */
export { AttendancePanel } from "./AttendancePanel";
export { AttendanceLanding } from "./landing/AttendanceLanding";
export { buildAttendanceLanding } from "./landing/landing";
export { AttendanceHeader } from "./components/AttendanceHeader";
export { AttendanceSheet } from "./components/AttendanceSheet";
export { AttendanceToolbar } from "./components/AttendanceToolbar";
export { AttentionRail } from "./components/AttentionRail";
export { Avatar } from "./components/Avatar";
export { DaySummaryRail } from "./components/DaySummaryRail";
export { FilterChips } from "./components/FilterChips";
export { ShortcutsSheet } from "./components/ShortcutsSheet";
export { StatusCell } from "./components/StatusCell";
export { StudentPopover } from "./components/StudentPopover";
export { StudentExpediente } from "./components/StudentExpediente";
export { SyncIndicator } from "./components/SyncIndicator";

export { useAttendanceSession } from "./hooks/useAttendanceSession";
export { useAttendanceHotkeys } from "./hooks/useAttendanceHotkeys";

export * from "./data/selectors";
export * from "./format";
export * from "./statusMeta";
export * from "./types";
