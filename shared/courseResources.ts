/**
 * Reglas de los archivos que un docente puede subir como recurso de curso.
 * El tipo de contenido se decide aquí por la extensión, nunca por lo que envía el navegador,
 * y no se admiten HTML ni SVG para que un recurso no pueda ejecutar código al abrirse.
 */

export const MAX_RESOURCE_BYTES = 20 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
};

export const ALLOWED_RESOURCE_EXTENSIONS = Object.keys(CONTENT_TYPES);

export type ResourceFileCheck =
  | { ok: true; extension: string; contentType: string; storageName: string }
  | { ok: false; message: string };

export function checkResourceFile(fileName: string, sizeBytes: number): ResourceFileCheck {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return { ok: false, message: `Formato no permitido. Usa ${ALLOWED_RESOURCE_EXTENSIONS.join(", ").toUpperCase()}.` };
  }
  if (sizeBytes === 0) return { ok: false, message: "El archivo está vacío." };
  if (sizeBytes > MAX_RESOURCE_BYTES) return { ok: false, message: "El archivo supera el máximo de 20 MB." };

  // Nombre de almacenamiento sin tildes ni caracteres especiales; el nombre original se guarda aparte
  const stem = base
    .slice(0, dot)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return { ok: true, extension, contentType, storageName: `${stem || "recurso"}.${extension}` };
}
