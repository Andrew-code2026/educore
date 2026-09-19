import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { EduRole, ModuleContext, Section } from "./shell.types";
import { ALL_NAV_ITEMS } from "./navigation";

interface ShellContextType {
  moduleContext: ModuleContext | null;
  setModuleContext: (ctx: ModuleContext | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMoreOpen: boolean;
  setMobileMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeSection: Section;
  activeRole: EduRole;
  schoolName: string;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

const COLLAPSED_STORAGE_KEY = "educore-sidebar-collapsed";

interface ShellProviderProps {
  children: React.ReactNode;
  section: Section;
  role: EduRole;
  schoolName: string;
}

export function ShellContextProvider({
  children,
  section,
  role,
  schoolName,
}: ShellProviderProps) {
  const [explicitContext, setExplicitContext] = useState<ModuleContext | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Persistir colapso del sidebar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Ignorar fallos de storage
    }
  }, [sidebarCollapsed]);

  // Limpiar contexto explícito al cambiar de sección
  useEffect(() => {
    setExplicitContext(null);
  }, [section, role]);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  // Setter seguro con comparación para evitar re-render loops
  const setModuleContext = React.useCallback((ctx: ModuleContext | null) => {
    setExplicitContext(prev => {
      if (!prev && !ctx) return prev;
      if (
        prev &&
        ctx &&
        prev.title === ctx.title &&
        prev.subtitle === ctx.subtitle &&
        JSON.stringify(prev.breadcrumbs) === JSON.stringify(ctx.breadcrumbs) &&
        JSON.stringify(prev.contextPills) === JSON.stringify(ctx.contextPills) &&
        prev.actions === ctx.actions
      ) {
        return prev;
      }
      return ctx;
    });
  }, []);

  // Contexto por defecto según la sección si la página no suministró uno explícito
  const resolvedContext = useMemo<ModuleContext>(() => {
    if (explicitContext) {
      return explicitContext;
    }

    const item = ALL_NAV_ITEMS[section] ?? ALL_NAV_ITEMS.overview;

    switch (section) {
      case "overview":
        return {
          title: "Inicio",
          subtitle: schoolName,
          breadcrumbs: [{ label: "Inicio", isCurrent: true }],
          contextPills: [{ label: schoolName, tone: "default" }, { label: "Año 2026", tone: "primary" }],
        };
      case "grades":
        return {
          title: role === "student" ? "Mis Calificaciones" : role === "guardian" ? "Rendimiento" : "Grade Center",
          subtitle: role === "student" ? "Seguimiento personal" : role === "guardian" ? "Seguimiento de estudiante" : "Matriz de calificaciones",
          breadcrumbs: [
            { label: "Académico" },
            { label: role === "student" ? "Calificaciones" : "Grade Center", isCurrent: true },
          ],
          contextPills: [{ label: "11-2 · Matemáticas", tone: "primary" }, { label: "Periodo 2", tone: "default" }],
        };
      case "academic":
        return {
          title: "Estructura Académica",
          subtitle: "Cursos, materias y asignaciones",
          breadcrumbs: [{ label: "Institución" }, { label: "Académico", isCurrent: true }],
          contextPills: [{ label: "Año activo 2026", tone: "primary" }],
        };
      case "attendance":
        return {
          title: "Asistencia",
          subtitle: "Registro y novedades del día",
          breadcrumbs: [{ label: "Operación" }, { label: "Asistencia", isCurrent: true }],
          contextPills: [{ label: "11-2", tone: "primary" }, { label: "Hoy", tone: "default" }],
        };
      case "classroom":
        return {
          title: "Classroom",
          subtitle: "Actividades pedagógicas y tareas",
          breadcrumbs: [{ label: "Enseñanza" }, { label: "Classroom", isCurrent: true }],
          contextPills: [{ label: "11-2 · Matemáticas", tone: "primary" }],
        };
      case "calendar":
        return {
          title: "Calendario",
          subtitle: "Agenda escolar y eventos",
          breadcrumbs: [{ label: "Agenda" }, { label: "Calendario", isCurrent: true }],
          contextPills: [{ label: "Septiembre 2026", tone: "default" }],
        };
      case "communications":
        return {
          title: "Comunicaciones",
          subtitle: "Avisos institucionales y comunidad",
          breadcrumbs: [{ label: "Comunidad" }, { label: "Comunicaciones", isCurrent: true }],
          contextPills: [{ label: "Toda la comunidad", tone: "default" }],
        };
      case "reports":
        return {
          title: "Reportes & Analítica",
          subtitle: "Consolidado institucional y boletines",
          breadcrumbs: [{ label: "Análisis" }, { label: "Reportes", isCurrent: true }],
          contextPills: [{ label: "Periodo 2", tone: "primary" }],
        };
      case "ai":
        return {
          title: "EduCore AI",
          subtitle: "Copiloto pedagógico y analítico",
          breadcrumbs: [{ label: "Inteligencia" }, { label: "EduCore AI", isCurrent: true }],
          contextPills: [{ label: "Modo contextual activo", tone: "violet" }],
        };
      case "users":
        return {
          title: "Directorio de Usuarios",
          subtitle: "Identidades, roles y vinculaciones",
          breadcrumbs: [{ label: "Administración" }, { label: "Usuarios", isCurrent: true }],
          contextPills: [{ label: "Comunidad activa", tone: "default" }],
        };
      case "settings":
        return {
          title: "Configuración Institucional",
          subtitle: "Identidad, tema y periodos escolares",
          breadcrumbs: [{ label: "Administración" }, { label: "Configuración", isCurrent: true }],
          contextPills: [{ label: schoolName, tone: "primary" }],
        };
      default:
        return {
          title: item.label,
          subtitle: item.description,
          breadcrumbs: [{ label: item.label, isCurrent: true }],
        };
    }
  }, [explicitContext, section, role, schoolName]);

  const value = useMemo<ShellContextType>(
    () => ({
      moduleContext: resolvedContext,
      setModuleContext,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      mobileOpen,
      setMobileOpen,
      mobileMoreOpen,
      setMobileMoreOpen,
      activeSection: section,
      activeRole: role,
      schoolName,
    }),
    [
      resolvedContext,
      setModuleContext,
      sidebarCollapsed,
      toggleSidebar,
      mobileOpen,
      mobileMoreOpen,
      section,
      role,
      schoolName,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellContext() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShellContext debe ser usado dentro de ShellContextProvider");
  }
  return context;
}
