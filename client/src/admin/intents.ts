/**
 * Intenciones de navegación entre páginas del portal directivo.
 * El Inicio o Académico pueden pedir que Usuarios abra el importador al montarse
 * sin agregar parámetros a la URL del shell (que solo reconoce la sección).
 */
export type UsersImportKind = "STUDENT" | "TEACHER" | "GUARDIAN";

let pendingUsersImport: UsersImportKind | null = null;

export function requestUsersImport(kind: UsersImportKind = "STUDENT") {
  pendingUsersImport = kind;
}

/** Devuelve el tipo pedido una sola vez por solicitud (o `null`). */
export function consumeUsersImportRequest(): UsersImportKind | null {
  const requested = pendingUsersImport;
  pendingUsersImport = null;
  return requested;
}
