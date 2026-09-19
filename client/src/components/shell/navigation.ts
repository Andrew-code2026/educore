import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import type { EduRole, NavGroup, NavItem, Section } from "./shell.types";

export const ROLE_LABELS: Record<EduRole, string> = {
  admin: "Administrador",
  teacher: "Docente",
  student: "Estudiante",
  guardian: "Acudiente",
};

export const ROLE_GREETINGS: Record<EduRole, string> = {
  admin: "Resumen institucional",
  teacher: "Buenos días, Laura.",
  student: "Hola, Sofía.",
  guardian: "Buenos días, Mariana.",
};

// Definición canónica de módulos del sistema
export const ALL_NAV_ITEMS: Record<Section, Omit<NavItem, "roles" | "groupKey" | "mobilePriority">> = {
  overview: {
    id: "overview",
    label: "Inicio",
    icon: LayoutDashboard,
    description: "Panel principal y resumen de actividad",
  },
  academic: {
    id: "academic",
    label: "Académico",
    icon: GraduationCap,
    description: "Cursos, materias, docentes y matrículas",
  },
  grades: {
    id: "grades",
    label: "Grade Center",
    icon: BarChart3,
    description: "Registro de notas, evaluaciones y definitivas",
  },
  classroom: {
    id: "classroom",
    label: "Classroom",
    icon: ClipboardList,
    description: "Actividades pedagógicas, tareas y entregas",
  },
  attendance: {
    id: "attendance",
    label: "Asistencia",
    icon: ClipboardCheck,
    description: "Control de asistencia diaria y novedades",
  },
  calendar: {
    id: "calendar",
    label: "Calendario",
    icon: CalendarDays,
    description: "Agenda escolar, eventos y evaluaciones",
  },
  communications: {
    id: "communications",
    label: "Comunicaciones",
    icon: Megaphone,
    description: "Avisos, circulares y mensajes comunitarios",
  },
  reports: {
    id: "reports",
    label: "Reportes",
    icon: BarChart3,
    description: "Boletines y analítica de rendimiento",
  },
  ai: {
    id: "ai",
    label: "EduCore AI",
    icon: Sparkles,
    description: "Copiloto pedagógico y analítico con IA",
  },
  users: {
    id: "users",
    label: "Usuarios",
    icon: Users,
    description: "Directorio institucional, accesos y roles",
  },
  settings: {
    id: "settings",
    label: "Configuración",
    icon: Settings2,
    description: "Identidad institucional, periodos y temas",
  },
};

// Estructura de grupos y prioridades por rol
export function getNavGroupsForRole(role: EduRole, notificationCount = 0): NavGroup[] {
  if (role === "teacher") {
    return [
      {
        key: "teaching",
        label: "Enseñanza",
        items: [
          { ...ALL_NAV_ITEMS.overview, roles: ["teacher"], groupKey: "teaching", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.grades, label: "Grade Center", roles: ["teacher"], groupKey: "teaching", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.classroom, label: "Classroom", roles: ["teacher"], groupKey: "teaching", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.academic, label: "Mis clases", roles: ["teacher"], groupKey: "teaching", mobilePriority: "more" },
        ],
      },
      {
        key: "tracking",
        label: "Seguimiento",
        items: [
          { ...ALL_NAV_ITEMS.attendance, roles: ["teacher"], groupKey: "tracking", mobilePriority: "more" },
          { ...ALL_NAV_ITEMS.calendar, roles: ["teacher"], groupKey: "tracking", mobilePriority: "more" },
          { ...ALL_NAV_ITEMS.reports, roles: ["teacher"], groupKey: "tracking", mobilePriority: "more" },
        ],
      },
      {
        key: "communication",
        label: "Comunidad & IA",
        items: [
          {
            ...ALL_NAV_ITEMS.communications,
            roles: ["teacher"],
            groupKey: "communication",
            mobilePriority: "more",
            badge: notificationCount > 0 ? notificationCount : undefined,
          },
          { ...ALL_NAV_ITEMS.ai, roles: ["teacher"], groupKey: "communication", mobilePriority: "more" },
        ],
      },
    ];
  }

  if (role === "student") {
    return [
      {
        key: "learning",
        label: "Mi Aprendizaje",
        items: [
          { ...ALL_NAV_ITEMS.overview, roles: ["student"], groupKey: "learning", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.grades, label: "Calificaciones", roles: ["student"], groupKey: "learning", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.classroom, label: "Tareas", roles: ["student"], groupKey: "learning", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.attendance, label: "Asistencia", roles: ["student"], groupKey: "learning", mobilePriority: "more" },
        ],
      },
      {
        key: "organization",
        label: "Organización",
        items: [
          { ...ALL_NAV_ITEMS.calendar, roles: ["student"], groupKey: "organization", mobilePriority: "more" },
          {
            ...ALL_NAV_ITEMS.communications,
            roles: ["student"],
            groupKey: "organization",
            mobilePriority: "more",
            badge: notificationCount > 0 ? notificationCount : undefined,
          },
        ],
      },
      {
        key: "intelligence",
        label: "Inteligencia",
        items: [
          { ...ALL_NAV_ITEMS.ai, roles: ["student"], groupKey: "intelligence", mobilePriority: "more" },
        ],
      },
    ];
  }

  if (role === "guardian") {
    return [
      {
        key: "family_tracking",
        label: "Seguimiento Familiar",
        items: [
          { ...ALL_NAV_ITEMS.overview, roles: ["guardian"], groupKey: "family_tracking", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.grades, label: "Rendimiento", roles: ["guardian"], groupKey: "family_tracking", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.attendance, label: "Asistencia", roles: ["guardian"], groupKey: "family_tracking", mobilePriority: "bottom" },
          { ...ALL_NAV_ITEMS.calendar, label: "Calendario", roles: ["guardian"], groupKey: "family_tracking", mobilePriority: "more" },
        ],
      },
      {
        key: "communication",
        label: "Comunidad & IA",
        items: [
          {
            ...ALL_NAV_ITEMS.communications,
            roles: ["guardian"],
            groupKey: "communication",
            mobilePriority: "more",
            badge: notificationCount > 0 ? notificationCount : undefined,
          },
          { ...ALL_NAV_ITEMS.ai, roles: ["guardian"], groupKey: "communication", mobilePriority: "more" },
        ],
      },
    ];
  }

  // Admin / Rector
  return [
    {
      key: "institution",
      label: "Institución",
      items: [
        { ...ALL_NAV_ITEMS.overview, roles: ["admin"], groupKey: "institution", mobilePriority: "bottom" },
        { ...ALL_NAV_ITEMS.academic, roles: ["admin"], groupKey: "institution", mobilePriority: "bottom" },
        { ...ALL_NAV_ITEMS.users, roles: ["admin"], groupKey: "institution", mobilePriority: "more" },
        { ...ALL_NAV_ITEMS.settings, roles: ["admin"], groupKey: "institution", mobilePriority: "more" },
      ],
    },
    {
      key: "operation",
      label: "Operación Educativa",
      items: [
        { ...ALL_NAV_ITEMS.grades, roles: ["admin"], groupKey: "operation", mobilePriority: "bottom" },
        { ...ALL_NAV_ITEMS.attendance, roles: ["admin"], groupKey: "operation", mobilePriority: "more" },
        { ...ALL_NAV_ITEMS.classroom, roles: ["admin"], groupKey: "operation", mobilePriority: "more" },
        { ...ALL_NAV_ITEMS.calendar, roles: ["admin"], groupKey: "operation", mobilePriority: "more" },
      ],
    },
    {
      key: "analysis_comm",
      label: "Análisis & Comunidad",
      items: [
        { ...ALL_NAV_ITEMS.reports, roles: ["admin"], groupKey: "analysis_comm", mobilePriority: "more" },
        {
          ...ALL_NAV_ITEMS.communications,
          roles: ["admin"],
          groupKey: "analysis_comm",
          mobilePriority: "more",
          badge: notificationCount > 0 ? notificationCount : undefined,
        },
        { ...ALL_NAV_ITEMS.ai, roles: ["admin"], groupKey: "analysis_comm", mobilePriority: "more" },
      ],
    },
  ];
}

// Obtener lista plana de items visibles para el rol
export function getFlatNavItemsForRole(role: EduRole, notificationCount = 0): NavItem[] {
  const groups = getNavGroupsForRole(role, notificationCount);
  return groups.flatMap(group => group.items);
}

// Obtener los 3 items prioritarios para la barra inferior móvil
export function getMobileBottomNavItems(role: EduRole, notificationCount = 0): NavItem[] {
  const flat = getFlatNavItemsForRole(role, notificationCount);
  const bottomItems = flat.filter(item => item.mobilePriority === "bottom");
  // Exactamente los primeros 3 items para dejar el 4to espacio para "Más"
  return bottomItems.slice(0, 3);
}

// Obtener grupos que contienen los items para el drawer "Más" móvil
export function getMoreNavGroups(role: EduRole, notificationCount = 0): NavGroup[] {
  const groups = getNavGroupsForRole(role, notificationCount);
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.mobilePriority === "more"),
    }))
    .filter(group => group.items.length > 0);
}
