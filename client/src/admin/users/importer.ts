/**
 * Lectura de archivos de carga masiva (CSV de Excel o texto pegado desde una hoja).
 * Sin dependencias: detecta el separador (`;` de Excel en español, `,` o tabulación),
 * respeta comillas, quita el BOM y reconoce encabezados en español con o sin tildes.
 * La validación de fondo (correos existentes, cursos, estudiantes) la hace el servidor.
 */

export type ImportKind = "STUDENT" | "TEACHER" | "GUARDIAN";
export type ImportRelationship = "PARENT" | "LEGAL_GUARDIAN" | "OTHER";

export const IMPORT_MAX_ROWS = 500;

export interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentId?: string;
  course?: string;
  specialty?: string;
  studentEmail?: string;
  relationship?: ImportRelationship;
}

type RowKey = keyof ImportRow;

interface TemplateColumn {
  key: RowKey;
  header: string;
  required: boolean;
}

export const IMPORT_KIND_META: Record<ImportKind, { label: string; plural: string; description: string; columns: TemplateColumn[]; examples: string[][] }> = {
  STUDENT: {
    label: "Estudiante",
    plural: "Estudiantes",
    description: "Con curso: quedan matriculados y listos en asistencia y notas.",
    columns: [
      { key: "firstName", header: "nombres", required: true },
      { key: "lastName", header: "apellidos", required: true },
      { key: "email", header: "correo", required: true },
      { key: "documentId", header: "documento", required: false },
      { key: "course", header: "curso", required: false },
      { key: "phone", header: "telefono", required: false },
    ],
    examples: [
      ["María José", "Gómez Ruiz", "maria.gomez@colegio.edu.co", "1102345678", "11-1", "3001234567"],
      ["Samuel", "Ortiz Peña", "samuel.ortiz@colegio.edu.co", "1102345679", "11-2", ""],
    ],
  },
  TEACHER: {
    label: "Docente",
    plural: "Docentes",
    description: "Luego les asignas cursos y materias desde Académico.",
    columns: [
      { key: "firstName", header: "nombres", required: true },
      { key: "lastName", header: "apellidos", required: true },
      { key: "email", header: "correo", required: true },
      { key: "documentId", header: "documento", required: false },
      { key: "specialty", header: "especialidad", required: false },
      { key: "phone", header: "telefono", required: false },
    ],
    examples: [
      ["Laura", "Gómez Arango", "laura.gomez@colegio.edu.co", "43123456", "Matemáticas", "3109876543"],
      ["Andrés", "Molina Ríos", "andres.molina@colegio.edu.co", "71234567", "Lengua Castellana", ""],
    ],
  },
  GUARDIAN: {
    label: "Acudiente",
    plural: "Acudientes",
    description: "Con el correo del estudiante quedan vinculados a su familia.",
    columns: [
      { key: "firstName", header: "nombres", required: true },
      { key: "lastName", header: "apellidos", required: true },
      { key: "email", header: "correo", required: true },
      { key: "phone", header: "telefono", required: false },
      { key: "studentEmail", header: "correo_estudiante", required: false },
      { key: "relationship", header: "parentesco", required: false },
    ],
    examples: [
      ["Mariana", "Martínez", "mariana.martinez@correo.com", "3001112233", "maria.gomez@colegio.edu.co", "madre"],
      ["Jorge", "Ortiz", "jorge.ortiz@correo.com", "", "samuel.ortiz@colegio.edu.co", "padre"],
    ],
  },
};

/** Límites del servidor por campo: se recortan para no rechazar el lote completo. */
const FIELD_MAX: Record<RowKey, number> = {
  firstName: 100,
  lastName: 100,
  email: 320,
  phone: 40,
  documentId: 60,
  course: 60,
  specialty: 120,
  studentEmail: 320,
  relationship: 20,
};

export const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type HeaderKey = RowKey | "fullName";

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  firstName: ["nombres", "nombre", "primer nombre", "first name", "firstname", "nombres estudiante"],
  lastName: ["apellidos", "apellido", "last name", "lastname", "primer apellido"],
  fullName: ["nombre completo", "nombres y apellidos", "nombre y apellido", "full name"],
  email: ["correo", "email", "e mail", "correo electronico", "correo institucional", "mail"],
  phone: ["telefono", "celular", "movil", "phone", "telefono contacto"],
  documentId: ["documento", "codigo", "identificacion", "numero de documento", "no documento", "codigo estudiante", "cedula", "tarjeta de identidad", "doc"],
  course: ["curso", "grupo", "salon", "course", "grado y grupo"],
  specialty: ["especialidad", "area", "materia", "asignatura", "area de formacion"],
  studentEmail: ["correo estudiante", "correo del estudiante", "email estudiante", "email del estudiante", "estudiante"],
  relationship: ["parentesco", "relacion", "vinculo"],
};

const ALIAS_TO_KEY = new Map<string, HeaderKey>(
  (Object.entries(HEADER_ALIASES) as Array<[HeaderKey, string[]]>).flatMap(([key, aliases]) => aliases.map(alias => [alias, key] as [string, HeaderKey])),
);

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Array<[string, number]> = ["\t", ";", ","].map(delimiter => {
    let count = 0;
    let quoted = false;
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) count += 1;
    }
    return [delimiter, count];
  });
  const [best] = counts.sort((a, b) => b[1] - a[1]);
  return best[1] > 0 ? best[0] : ",";
}

/** CSV estilo RFC 4180: comillas dobles, comillas escapadas ("") y saltos de línea dentro de comillas. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map(cells => cells.map(value => value.trim()));
}

/** "María José Gómez Ruiz" → nombres "María José", apellidos "Gómez Ruiz" (convención colombiana). */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length === 3) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  return { firstName: parts.slice(0, parts.length - 2).join(" "), lastName: parts.slice(-2).join(" ") };
}

export function normalizeRelationship(value: string | undefined): ImportRelationship | undefined {
  const key = normalizeHeader(value ?? "");
  if (!key) return undefined;
  if (/(padre|madre|papa|mama|parent)/.test(key)) return "PARENT";
  if (/(tutor|legal|custodio)/.test(key)) return "LEGAL_GUARDIAN";
  return "OTHER";
}

export interface ParsedImport {
  rows: Array<{ line: number; row: ImportRow }>;
  delimiter: string;
  /** Columnas reconocidas en el orden del archivo. */
  columns: HeaderKey[];
  missingColumns: string[];
  ignoredColumns: string[];
  tooMany: boolean;
  error?: string;
}

const EMPTY_RESULT = (delimiter: string, error: string): ParsedImport => ({
  rows: [],
  delimiter,
  columns: [],
  missingColumns: [],
  ignoredColumns: [],
  tooMany: false,
  error,
});

export function parseImportText(text: string, kind: ImportKind): ParsedImport {
  if (!text.trim()) return EMPTY_RESULT(",", "El archivo está vacío.");
  const delimiter = detectDelimiter(text.replace(/^﻿/, ""));
  const table = parseDelimited(text, delimiter).filter(cells => cells.some(Boolean));
  if (table.length < 2) return EMPTY_RESULT(delimiter, "Incluye una fila de encabezados y al menos una persona.");

  const headers = table[0].map(normalizeHeader);
  const keys = headers.map(header => ALIAS_TO_KEY.get(header) ?? null);
  const allowed = new Set<HeaderKey>([...IMPORT_KIND_META[kind].columns.map(column => column.key), "fullName"]);
  const columns = keys.filter((key): key is HeaderKey => key !== null && allowed.has(key));
  const ignoredColumns = table[0].filter((_, index) => !keys[index] || !allowed.has(keys[index]!)).filter(Boolean);

  // Una sola columna "nombre" sin "apellidos" se interpreta como nombre completo
  const nameOnly = columns.includes("firstName") && !columns.includes("lastName") && !columns.includes("fullName");
  const hasNames = (columns.includes("firstName") && columns.includes("lastName")) || columns.includes("fullName") || nameOnly;
  const missingColumns = [
    ...(hasNames ? [] : ["nombres y apellidos"]),
    ...(columns.includes("email") ? [] : ["correo"]),
  ];

  const body = table.slice(1);
  const clip = (key: RowKey, value: string | undefined) => (value ? value.slice(0, FIELD_MAX[key]) : undefined);
  const rows = body.slice(0, IMPORT_MAX_ROWS).map((cells, index) => {
    const values: Partial<Record<HeaderKey, string>> = {};
    keys.forEach((key, column) => {
      if (key && allowed.has(key) && values[key] === undefined) values[key] = cells[column] ?? "";
    });
    const fullName = nameOnly ? values.firstName : values.fullName;
    const split = fullName && !(values.firstName && values.lastName) ? splitFullName(fullName) : null;
    const optional: Partial<ImportRow> = {};
    const phone = clip("phone", values.phone);
    const documentId = clip("documentId", values.documentId);
    const course = clip("course", values.course);
    const specialty = clip("specialty", values.specialty);
    const studentEmail = clip("studentEmail", values.studentEmail)?.toLowerCase();
    const relationship = normalizeRelationship(values.relationship);
    if (phone) optional.phone = phone;
    if (documentId) optional.documentId = documentId;
    if (course) optional.course = course;
    if (specialty) optional.specialty = specialty;
    if (studentEmail) optional.studentEmail = studentEmail;
    if (relationship) optional.relationship = relationship;
    const row: ImportRow = {
      firstName: clip("firstName", split?.firstName ?? values.firstName) ?? "",
      lastName: clip("lastName", split?.lastName ?? values.lastName) ?? "",
      email: (clip("email", values.email) ?? "").toLowerCase(),
      ...optional,
    };
    return { line: index + 2, row };
  });

  return {
    rows,
    delimiter,
    columns,
    missingColumns,
    ignoredColumns,
    tooMany: body.length > IMPORT_MAX_ROWS,
  };
}

const csvCell = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Plantilla para Excel en español: separador `;`, BOM para conservar tildes, fin de línea CRLF. */
export function buildTemplateCsv(kind: ImportKind): string {
  const meta = IMPORT_KIND_META[kind];
  const lines = [meta.columns.map(column => column.header), ...meta.examples];
  return `﻿${lines.map(cells => cells.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

export function buildErrorReportCsv(rows: Array<{ line: number; name: string; email: string; message: string }>): string {
  const lines = [["fila", "nombre", "correo", "motivo"], ...rows.map(row => [String(row.line), row.name, row.email, row.message])];
  return `﻿${lines.map(cells => cells.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** Decodifica UTF-8 y, si el archivo viene de un Excel antiguo (ANSI), Windows-1252. */
export function decodeImportFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function downloadText(fileName: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
