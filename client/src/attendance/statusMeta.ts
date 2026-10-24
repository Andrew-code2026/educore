/** Metadatos de los estados de asistencia: etiqueta, tecla y clases visuales. */
import type { AttendanceStatus, AttentionFlag } from "./types";

export interface StatusMeta {
  label: string;
  /** Letra del control P | A | T | E. */
  letter: string;
  /** Tecla del atajo de teclado. */
  key: string;
  /** Descripción corta para tooltips y accesibilidad. */
  hint: string;
}

export const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  present: { label: "Presente", letter: "P", key: "P", hint: "Presente" },
  absent: { label: "Ausente", letter: "A", key: "A", hint: "Ausente" },
  late: { label: "Tardanza", letter: "T", key: "T", hint: "Tardanza" },
  excuse: { label: "Excusa", letter: "E", key: "E", hint: "Excusa" },
  // El guion largo identifica el quinto estado cuando aparece como control.
  pending: { label: "Pendiente", letter: "—", key: "Supr", hint: "Sin registrar" },
};

/** Orden de los controles en la celda de cada estudiante. */
export const STATUS_CONTROLS: AttendanceStatus[] = ["present", "absent", "late", "excuse"];

/** Etiqueta larga de cada control, para el popover del estudiante. */
export const STATUS_CONTROL_LABELS: Record<AttendanceStatus, string> = {
  present: "Presente",
  absent: "Ausente",
  late: "Tardanza",
  excuse: "Excusa",
  pending: "Pendiente",
};

export const STATUS_CELL_ACTIVE: Record<AttendanceStatus, string> = {
  present: "bg-st-present/14 text-st-present ring-1 ring-inset ring-st-present/45",
  absent: "bg-st-absent/14 text-st-absent ring-1 ring-inset ring-st-absent/45",
  late: "bg-st-late/16 text-st-late ring-1 ring-inset ring-st-late/45",
  excuse: "bg-st-excuse/14 text-st-excuse ring-1 ring-inset ring-st-excuse/45",
  pending: "bg-foreground/[0.05] text-muted-foreground ring-1 ring-inset ring-hairline",
};

export const STATUS_CELL_IDLE =
  // Contraste suficiente para que un control inactivo no parezca deshabilitado.
  "text-foreground/70 hover:bg-foreground/[0.07] hover:text-foreground";

export const STATUS_RING: Record<AttendanceStatus, string> = {
  present: "ring-st-present",
  absent: "ring-st-absent",
  late: "ring-st-late",
  excuse: "ring-st-excuse",
  pending: "ring-st-pending",
};

export const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: "bg-st-present",
  absent: "bg-st-absent",
  late: "bg-st-late",
  excuse: "bg-st-excuse",
  pending: "bg-st-pending/50",
};

export const STATUS_CHIP: Record<AttendanceStatus, string> = {
  present: "bg-st-present/12 text-st-present ring-1 ring-inset ring-st-present/25",
  absent: "bg-st-absent/12 text-st-absent ring-1 ring-inset ring-st-absent/25",
  late: "bg-st-late/14 text-st-late ring-1 ring-inset ring-st-late/25",
  excuse: "bg-st-excuse/12 text-st-excuse ring-1 ring-inset ring-st-excuse/25",
  pending: "bg-foreground/[0.05] text-muted-foreground ring-1 ring-inset ring-hairline",
};

export const SEVERITY_CLASS: Record<AttentionFlag["severity"], string> = {
  high: "bg-st-absent/12 text-st-absent ring-1 ring-inset ring-st-absent/25",
  medium: "bg-st-late/14 text-st-late ring-1 ring-inset ring-st-late/25",
  low: "bg-st-excuse/12 text-st-excuse ring-1 ring-inset ring-st-excuse/25",
};

export const SEVERITY_DOT: Record<AttentionFlag["severity"], string> = {
  high: "bg-st-absent",
  medium: "bg-st-late",
  low: "bg-st-excuse",
};
  // El guion largo identifica el quinto estado cuando aparece como control.
