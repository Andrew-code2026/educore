import React from "react";
import {
  LogOut,
  PanelLeftClose,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EduRole, Section } from "./shell.types";
import { getNavGroupsForRole, ROLE_LABELS } from "./navigation";
import { useShellContext } from "./ShellContext";

interface EduCoreSidebarProps {
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  school: any;
  schoolName: string;
  onLogout: () => void;
  notificationCount?: number;
}

const storageUrl = (value: string | null | undefined): string | undefined =>
  value ? value.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment))).join("/") : undefined;

const getRoleAvatarInitials = (role: EduRole) => {
  switch (role) {
    case "admin":
      return "RC";
    case "teacher":
      return "LG";
    case "guardian":
      return "MM";
    case "student":
      return "SM";
  }
};

export function EduCoreSidebar({
  role,
  section,
  setSection,
  school,
  schoolName,
  onLogout,
  notificationCount = 0,
}: EduCoreSidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useShellContext();
  const groups = getNavGroupsForRole(role, notificationCount);

  // Atajo de teclado (Ctrl+B / ⌘+B) para colapsar/expandir el sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const logoBadge = (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_7px_16px_rgba(37,99,235,0.25)]">
      {school?.logoUrl ? (
        <img
          src={storageUrl(school.logoUrl)}
          alt="Escudo institucional"
          className="h-full w-full rounded-[13px] object-contain p-1"
        />
      ) : (
        <GraduationCap className="h-[18px] w-[18px]" />
      )}
      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan-300 ring-2 ring-white" />
    </div>
  );

  return (
    <aside
      aria-label="Navegación principal"
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-white/95 backdrop-blur-md transition-all duration-200 ease-out lg:flex ${
        sidebarCollapsed ? "w-[72px]" : "w-[250px]"
      } border-slate-200/90`}
      style={{
        boxShadow: "1px 0 12px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Encabezado de Marca y Toggle */}
      <div
        className={`flex h-[62px] items-center border-b border-slate-100 px-3 ${
          sidebarCollapsed ? "justify-center" : "justify-between"
        }`}
      >
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expandir menú lateral"
                className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
              >
                {logoBadge}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              <p className="font-semibold">Expandir menú (Ctrl+B)</p>
              <p className="text-[10px] text-slate-300">{schoolName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              {logoBadge}
              <div className="min-w-0 transition-opacity duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-extrabold tracking-[0.16em] text-slate-950">
                    EDUCORE
                  </span>
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0 text-[8px] font-bold tracking-wider text-blue-700">
                    2.0
                  </span>
                </div>
                <p className="truncate text-[10px] font-medium tracking-[0.01em] text-slate-500">
                  {schoolName}
                </p>
              </div>
            </div>

            {/* Botón de colapso / expansión */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Colapsar menú lateral"
              title="Colapsar menú (Ctrl+B)"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Lista de Navegación por Grupos Semánticos */}
      <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-none">
        <nav className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={group.key} className="space-y-1">
              {!sidebarCollapsed ? (
                <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </p>
              ) : groupIndex > 0 ? (
                <div className="my-2 border-t border-slate-100 px-2" />
              ) : null}

              <div className="space-y-0.5 pt-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = section === item.id;

                  const buttonContent = (
                    <button
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`group relative flex w-full items-center rounded-xl py-2.5 transition-all duration-150 cursor-pointer ${
                        sidebarCollapsed
                          ? "justify-center px-0"
                          : "justify-start px-3 gap-3"
                      } ${
                        isActive
                          ? "bg-[var(--edc-secondary)] font-semibold text-[var(--edc-primary)] shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {/* Indicador visual activo en borde izquierdo cuando está expandido */}
                      {isActive && !sidebarCollapsed && (
                        <span
                          className="absolute left-1 h-5 w-1 rounded-full bg-[var(--edc-primary)]"
                          aria-hidden="true"
                        />
                      )}

                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive
                            ? "text-[var(--edc-primary)]"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />

                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate text-sm font-medium">{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--edc-primary)] px-1.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={12} className="font-medium">
                          <div>
                            <p className="font-semibold">{item.label}</p>
                            <p className="text-[10px] text-slate-300">{group.label}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return <div key={item.id}>{buttonContent}</div>;
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Tarjeta de Seguridad (solo expandido) */}
      {!sidebarCollapsed && (
        <div className="mx-3 mb-2 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-slate-700">Aislamiento Seguro</span>
          </div>
          <p className="mt-0.5 text-[10px] leading-3.5 text-slate-400 truncate">
            RBAC activo · {schoolName}
          </p>
        </div>
      )}

      {/* Footer de Usuario */}
      <div
        className={`border-t border-slate-100 p-2.5 ${
          sidebarCollapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-3"
        }`}
      >
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 cursor-default items-center justify-center rounded-full bg-[var(--edc-secondary)] text-xs font-bold text-[var(--edc-primary)] ring-1 ring-slate-200">
                {getRoleAvatarInitials(role)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              <p className="font-semibold">{ROLE_LABELS[role]}</p>
              <p className="text-[10px] text-slate-300">{schoolName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--edc-secondary)] text-xs font-bold text-[var(--edc-primary)] ring-1 ring-slate-200">
            {getRoleAvatarInitials(role)}
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800">
              {role === "admin" ? "Rectoría / Admin" : ROLE_LABELS[role]}
            </p>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {schoolName}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
