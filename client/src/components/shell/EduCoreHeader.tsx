import React, { useState, useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import type { EduRole, Section } from "./shell.types";
import { useShellContext } from "./ShellContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitch } from "./ThemeSwitch";

interface EduCoreHeaderProps {
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  onRoleChange: (role: EduRole) => void;
  notificationCount?: number;
  user?: any;
}

const ROLE_PROFILES: Record<EduRole, { name: string; roleLabel: string; menuLabel: string; initials: string }> = {
  teacher: { name: "Prof. Juan Diego Loaiza", roleLabel: "Docente", menuLabel: "Docente", initials: "JD" },
  admin: { name: "Dra. Carolina Restrepo", roleLabel: "Rectoría", menuLabel: "Rectoría / Coordinación", initials: "CR" },
  student: { name: "Sofía Martínez Cadavid", roleLabel: "Estudiante", menuLabel: "Estudiante", initials: "SM" },
  guardian: { name: "Fernando Martínez", roleLabel: "Acudiente", menuLabel: "Acudiente", initials: "FM" },
};

const initialsOf = (name: string) =>
  name
    .replace(/^Prof\.\s*/, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

const ChevronDown = () => (
  <svg className="edc-pill__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function EduCoreHeader({
  role,
  onRoleChange,
  notificationCount = 0,
  user,
}: EduCoreHeaderProps) {
  const { moduleContext, setMobileOpen } = useShellContext();
  const { theme, toggleTheme } = useTheme();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú de experiencia al hacer clic fuera o con Escape
  useEffect(() => {
    if (!roleMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoleMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [roleMenuOpen]);

  const handleNotificationClick = () => {
    if (notificationCount > 0) {
      toast.info(`Tienes ${notificationCount} aviso${notificationCount === 1 ? "" : "s"} sin leer en Comunicaciones.`);
    } else {
      toast.success("Al día: no tienes notificaciones pendientes.");
    }
  };

  const activeProfile = ROLE_PROFILES[role] || ROLE_PROFILES.teacher;
  const avatarInitials = role === "teacher" && user?.name ? initialsOf(user.name) : activeProfile.initials;

  return (
    <header className="edc-topbar edc-chrome">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className="edc-round-btn edc-menu-btn"
      >
        <Menu aria-hidden="true" />
      </button>

      <h1 className="edc-topbar__title">{moduleContext?.title ?? "EduCore"}</h1>
      <div className="edc-topbar__spacer" />

      {moduleContext?.actions && <div className="edc-topbar__module">{moduleContext.actions}</div>}

      <div className="edc-topbar__actions">
        <button type="button" className="edc-pill edc-pill--year">
          <span className="edc-pill__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
          </span>
          <span>Año {new Date().getFullYear()}</span>
          <ChevronDown />
        </button>

        {toggleTheme && (
          <div className="edc-theme-slot">
            <ThemeSwitch checked={theme === "dark"} onChange={toggleTheme} />
          </div>
        )}

        <button
          type="button"
          onClick={handleNotificationClick}
          aria-label={notificationCount > 0 ? `Notificaciones, ${notificationCount} sin leer` : "Notificaciones"}
          className="edc-round-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {notificationCount > 0 && <span className="edc-round-btn__count">{notificationCount}</span>}
        </button>

        <div ref={roleMenuRef} className="edc-profile">
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

          <button
            type="button"
            onClick={() => setRoleMenuOpen(open => !open)}
            aria-expanded={roleMenuOpen}
            aria-haspopup="menu"
            className="edc-pill edc-pill--profile"
          >
            <span className="edc-pill__avatar">{avatarInitials}</span>
            <span className="edc-pill__label">{activeProfile.roleLabel}</span>
            <ChevronDown />
          </button>

          {roleMenuOpen && (
            <div className="edc-profile-menu" role="menu">
              <div className="edc-profile-menu__label">Cambiar experiencia</div>
              {(["teacher", "admin", "student", "guardian"] as EduRole[]).map(opt => {
                const meta = ROLE_PROFILES[opt];
                const isSelected = role === opt;
                const subtitle = opt === "teacher" && user?.name ? (user.name.startsWith("Prof.") ? user.name : `Prof. ${user.name}`) : meta.name;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      onRoleChange(opt);
                      setRoleMenuOpen(false);
                    }}
                    className="edc-profile-menu__item"
                  >
                    <span className="edc-profile-menu__avatar">{initialsOf(subtitle)}</span>
                    <span className="edc-profile-menu__text">
                      <span className="edc-profile-menu__name">{meta.menuLabel}</span>
                      <span className="edc-profile-menu__sub">{subtitle}</span>
                    </span>
                    {isSelected && <span className="edc-profile-menu__dot" />}
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
