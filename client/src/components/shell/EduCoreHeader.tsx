import React from "react";
import {
  Bell,
  ChevronRight,
  Menu,
  Search,
  Sparkles,
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

export function EduCoreHeader({
  role,
  section,
  setSection,
  onRoleChange,
  notificationCount = 0,
}: EduCoreHeaderProps) {
  const { moduleContext, setMobileOpen } = useShellContext();

  const handleSearchClick = () => {
    toast.info("Búsqueda global institucional en preparación para la FASE 6.2.");
  };

  const handleNotificationClick = () => {
    if (notificationCount > 0) {
      toast.info(`Tienes ${notificationCount} aviso${notificationCount === 1 ? "" : "s"} sin leer en Comunicaciones.`);
    } else {
      toast.success("Al día: no tienes notificaciones pendientes.");
    }
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8"
      style={{
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
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
          {/* Breadcrumbs sutiles si existen */}
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

        {/* Buscador visual preparado */}
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Buscar en EduCore"
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-300 hover:bg-white sm:flex cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <span>Buscar</span>
          <kbd className="ml-2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Botón rápido EduCore AI */}
        <button
          type="button"
          onClick={() => setSection("ai")}
          className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition cursor-pointer ${
            section === "ai"
              ? "bg-[var(--edc-primary)] text-white shadow-xs"
              : "bg-[var(--edc-secondary)] text-[var(--edc-primary)] hover:opacity-90"
          }`}
          title="Abrir EduCore AI"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ask AI</span>
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

        {/* Selector de Rol Demo */}
        <div className="hidden items-center sm:flex">
          <select
            value={role}
            onChange={event => onRoleChange(event.target.value as EduRole)}
            aria-label="Cambiar vista demo"
            className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[var(--edc-primary)] cursor-pointer"
          >
            <option value="admin">Vista Administrador</option>
            <option value="teacher">Vista Docente</option>
            <option value="student">Vista Estudiante</option>
            <option value="guardian">Vista Acudiente</option>
          </select>
        </div>
      </div>
    </header>
  );
}
