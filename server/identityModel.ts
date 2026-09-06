export const IDENTITY_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "RECTOR",
  "COORDINATOR",
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
] as const;

export type IdentityRole = (typeof IDENTITY_ROLES)[number];

export const ROLE_LABELS: Record<IdentityRole, string> = {
  SUPER_ADMIN: "Super administrador",
  SCHOOL_ADMIN: "Administrador escolar",
  RECTOR: "Rectoría",
  COORDINATOR: "Coordinación",
  TEACHER: "Docente",
  STUDENT: "Estudiante",
  GUARDIAN: "Acudiente",
};

export const ROLE_DESCRIPTIONS: Record<IdentityRole, string> = {
  SUPER_ADMIN: "Administra la plataforma y sus instituciones.",
  SCHOOL_ADMIN: "Gestiona la institución, usuarios y configuración.",
  RECTOR: "Consulta la operación institucional y coordina la comunidad.",
  COORDINATOR: "Acompaña la gestión académica y el seguimiento institucional.",
  TEACHER: "Trabaja con cursos, actividades, calificaciones y asistencia.",
  STUDENT: "Consulta sus cursos, actividades, calificaciones y asistencia.",
  GUARDIAN: "Acompaña únicamente a los estudiantes vinculados.",
};

export const PERMISSIONS = [
  "institution.view", "institution.update",
  "users.view", "users.create", "users.update", "users.disable",
  "students.view", "students.create", "students.update",
  "teachers.view", "teachers.create", "teachers.update",
  "courses.view", "courses.create", "courses.update",
  "grades.view", "grades.create", "grades.update",
  "attendance.view", "attendance.create", "attendance.update",
  "assignments.view", "assignments.create", "assignments.update", "assignments.delete",
  "reports.view", "reports.create", "reports.export",
  "communications.view", "communications.create", "communications.send",
  "settings.view", "settings.update", "ai.use",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const PERMISSION_METADATA: Record<PermissionKey, { module: string; name: string; description: string }> = Object.fromEntries(
  PERMISSIONS.map(key => {
    const [module, action] = key.split(".");
    return [key, {
      module: module === "ai" ? "IA" : module.charAt(0).toUpperCase() + module.slice(1),
      name: `${module === "ai" ? "IA" : module.charAt(0).toUpperCase() + module.slice(1)} · ${action}`,
      description: `Permite ${action} en el módulo ${module === "ai" ? "de inteligencia artificial" : module}.`,
    }];
  }),
) as Record<PermissionKey, { module: string; name: string; description: string }>;

const rolePermissionSets: Record<IdentityRole, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  SCHOOL_ADMIN: [
    "institution.view", "institution.update", "users.view", "users.create", "users.update", "users.disable",
    "students.view", "students.create", "students.update", "teachers.view", "teachers.create", "teachers.update",
    "courses.view", "courses.create", "courses.update", "reports.view", "reports.export", "communications.view", "communications.create", "communications.send",
    "settings.view", "settings.update", "ai.use",
  ],
  RECTOR: [
    "institution.view", "users.view", "students.view", "teachers.view", "courses.view", "grades.view",
    "attendance.view", "reports.view", "reports.export", "communications.view", "communications.create", "ai.use",
  ],
  COORDINATOR: [
    "institution.view", "users.view", "students.view", "teachers.view", "courses.view", "grades.view", "grades.update",
    "attendance.view", "attendance.create", "attendance.update", "reports.view", "communications.view", "communications.create", "ai.use",
  ],
  TEACHER: [
    "students.view", "courses.view", "grades.view", "grades.create", "grades.update", "attendance.view", "attendance.create", "attendance.update",
    "assignments.view", "assignments.create", "assignments.update", "communications.view", "communications.create", "ai.use",
  ],
  STUDENT: ["courses.view", "grades.view", "attendance.view", "assignments.view", "assignments.create", "communications.view", "ai.use"],
  GUARDIAN: ["students.view", "grades.view", "attendance.view", "assignments.view", "communications.view", "reports.view"],
};

export function permissionsForRole(role: IdentityRole): PermissionKey[] {
  return rolePermissionSets[role] ?? [];
}

export function hasPermission(role: IdentityRole, permission: string): boolean {
  return permissionsForRole(role).includes(permission as PermissionKey);
}

export const DEMO_ROLE_MAP = {
  admin: "SCHOOL_ADMIN",
  teacher: "TEACHER",
  student: "STUDENT",
  guardian: "GUARDIAN",
} as const;

export type DemoRole = keyof typeof DEMO_ROLE_MAP;

export const ROLE_HIERARCHY: Record<IdentityRole, number> = {
  SUPER_ADMIN: 100,
  SCHOOL_ADMIN: 80,
  RECTOR: 70,
  COORDINATOR: 60,
  TEACHER: 40,
  STUDENT: 20,
  GUARDIAN: 20,
};
