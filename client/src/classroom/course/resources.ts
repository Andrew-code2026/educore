/**
 * Presentación de los recursos del curso. Sin dependencias de React para poder probarse aislado.
 */

export interface CourseResourceItem {
  id: number;
  title: string;
  fileName: string;
  fileUrl: string;
  sizeBytes: number;
  assignmentId: number | null;
  createdAt: Date | string;
}

/** "850 KB", "2,4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : '';
}

/** Título sugerido a partir del nombre del archivo: "guia_de-limites.pdf" → "Guia de limites". */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

export function searchResources<T extends CourseResourceItem>(resources: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('es');
  if (!q) return resources;
  return resources.filter((r) => `${r.title} ${r.fileName}`.toLocaleLowerCase('es').includes(q));
}
