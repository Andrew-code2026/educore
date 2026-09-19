import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  ChevronRight,
  Menu,
  Search,
  ChevronDown,
  BookOpen,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { EduRole, Section } from "./shell.types";
import { useShellContext } from "./ShellContext";

interface EduCoreHeaderProps {
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  onRoleChange: (role: EduRole) => void;
  notificationCount?: number;
}

const ROLE_PROFILES: Record<
  EduRole,
  { name: string; roleLabel: string; badge: string; avatar: string; icon: typeof BookOpen }
> = {
  teacher: {
    name: "Prof. Alejandro Valenzuela",
    roleLabel: "Docente",
    badge: "Docente Titular",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
    icon: BookOpen,
  },
  admin: {
    name: "Dra. Carolina Restrepo",
    roleLabel: "Rectoría",
    badge: "Rectoría / Admin",
    avatar:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=80",
    icon: ShieldAlert,
  },
  student: {
    name: "Sofía Martínez Cadavid",
    roleLabel: "Estudiante",
    badge: "Estudiante 11-2",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    icon: UserCheck,
  },
  guardian: {
    name: "Fernando Martínez",
    roleLabel: "Acudiente",
    badge: "Acudiente / Familia",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80",
    icon: Users,
  },
};

export function EduCoreHeader({
  role,
  section,
  setSection,
  onRoleChange,
  notificationCount = 0,
}: EduCoreHeaderProps) {
  const { moduleContext, setMobileOpen } = useShellContext();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Auto-compact on scroll (58px -> 48px)
  useEffect(() => {
    const handleScroll = () => setIsCompact(window.scrollY > 56);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close role popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchClick = () => {
    toast.info("Búsqueda institucional: Usa ⌘K para buscar estudiantes, cursos o acciones.");
  };

  const handleNotificationClick = () => {
    if (notificationCount > 0) {
      toast.info(`Tienes ${notificationCount} aviso${notificationCount === 1 ? "" : "s"} sin leer en Comunicaciones.`);
    } else {
      toast.success("Al día: no tienes notificaciones pendientes.");
    }
  };

  const activeProfile = ROLE_PROFILES[role] || ROLE_PROFILES.teacher;
  const ActiveRoleIcon = activeProfile.icon;

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md transition-all duration-300 sm:px-6 lg:px-8 ${
        isCompact ? "h-[50px] shadow-xs" : "h-[62px]"
      }`}
      style={{
        boxShadow: isCompact
          ? "0 4px 16px rgba(15, 23, 42, 0.05)"
          : "0 1px 3px rgba(15, 23, 42, 0.02)",
      }}
    >
      {/* Lado Izquierdo: Menú móvil + Barra de Contexto Dinámica */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Botón menú móvil */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú móvil"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Migas de Pan y Contexto */}
        <div className="flex min-w-0 flex-col justify-center">
          {/* Breadcrumbs sutiles */}
          {moduleContext?.breadcrumbs && moduleContext.breadcrumbs.length > 0 && (
            <div className="hidden items-center gap-1 text-[11px] text-slate-400 sm:flex">
              {moduleContext.breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.label + idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                  <span
                    className={
                      crumb.isCurrent
                        ? "font-semibold text-slate-700"
                        : "hover:text-slate-600 transition"
                    }
                  >
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Título y Context Pills */}
          <div className="flex items-center gap-2 overflow-hidden">
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
              {moduleContext?.title ?? "EduCore"}
            </h1>

            {/* Context Pills */}
            {moduleContext?.contextPills && moduleContext.contextPills.length > 0 && (
              <div className="hidden items-center gap-1.5 md:flex">
                {moduleContext.contextPills.map((pill, idx) => (
                  <span
                    key={pill.label + idx}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      pill.tone === "primary"
                        ? "bg-[var(--edc-secondary)] text-[var(--edc-primary)] font-semibold"
                        : pill.tone === "emerald"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : pill.tone === "amber"
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : pill.tone === "violet"
                        ? "bg-violet-50 text-violet-700 border border-violet-100"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {pill.label}
                    {pill.detail && (
                      <span className="ml-1 text-[10px] opacity-75">· {pill.detail}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lado Derecho: Acciones Contextuales + Búsqueda + IA + Notificaciones + Switcher Rol */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Acciones del módulo activo */}
        {moduleContext?.actions && (
          <div className="flex items-center gap-1.5">{moduleContext.actions}</div>
        )}

        {/* Buscador visual con atajo ⌘ K */}
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Buscar en EduCore"
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-500 transition hover:border-blue-200 hover:bg-white sm:flex cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden xl:inline">Buscar estudiantes, cursos o acciones...</span>
          <span className="xl:hidden">Buscar</span>
          <kbd className="ml-1.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Campana de Notificaciones con Badge Real */}
        <button
          type="button"
          onClick={handleNotificationClick}
          aria-label="Notificaciones"
          className="relative flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--edc-primary)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--edc-primary)]" />
            </span>
          )}
        </button>

        {/* Selector de Rol Enriquecido (Manus 2.0 Style) + Select Accesible */}
        <div ref={roleMenuRef} className="relative hidden items-center sm:flex">
          {/* Select accesible nativo (para automatización y lectores de pantalla) */}
          <select
            value={role}
            onChange={(event) => onRoleChange(event.target.value as EduRole)}
            aria-label="Cambiar vista demo"
            className="sr-only"
          >
            <option value="admin">Vista Administrador</option>
            <option value="teacher">Vista Docente</option>
            <option value="student">Vista Estudiante</option>
            <option value="guardian">Vista Acudiente</option>
          </select>

          {/* Botón interactivo con avatar y badge institucional */}
          <button
            type="button"
            onClick={() => setRoleMenuOpen((open) => !open)}
            aria-expanded={roleMenuOpen}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer"
          >
            <img
              src={activeProfile.avatar}
              alt={activeProfile.name}
              className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200"
            />
            <span className="hidden md:inline text-slate-800">{activeProfile.roleLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                roleMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Popover enriquecido */}
          {roleMenuOpen && (
            <div className="absolute right-0 top-11 z-[90] w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] animate-in fade-in zoom-in-95 duration-150">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Cambiar experiencia
              </p>
              {(["teacher", "admin", "student", "guardian"] as EduRole[]).map((opt) => {
                const meta = ROLE_PROFILES[opt];
                const Icon = meta.icon;
                const isSelected = role === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onRoleChange(opt);
                      setRoleMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <img
                      src={meta.avatar}
                      alt={meta.name}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold leading-tight">
                        {opt === "admin"
                          ? "Rectoría / Coordinación"
                          : opt === "teacher"
                          ? "Docente"
                          : opt === "student"
                          ? "Estudiante"
                          : "Acudiente"}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {meta.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
