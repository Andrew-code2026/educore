import React from "react";
import { LogOut, MoreHorizontal, ShieldCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EduRole, Section } from "./shell.types";
import {
  getMobileBottomNavItems,
  getMoreNavGroups,
  getNavGroupsForRole,
  ROLE_LABELS,
} from "./navigation";
import { useShellContext } from "./ShellContext";
import { NavIcon } from "./EduCoreSidebar";

interface EduCoreMobileNavProps {
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  school: any;
  schoolName: string;
  onRoleChange: (role: EduRole) => void;
  onLogout: () => void;
  notificationCount?: number;
}

export function EduCoreMobileNav({
  role,
  section,
  setSection,
  school,
  schoolName,
  onRoleChange,
  onLogout,
  notificationCount = 0,
}: EduCoreMobileNavProps) {
  const {
    mobileOpen,
    setMobileOpen,
    mobileMoreOpen,
    setMobileMoreOpen,
    isFocusMode,
  } = useShellContext();

  const bottomItems = getMobileBottomNavItems(role, notificationCount);
  const moreGroups = getMoreNavGroups(role, notificationCount);
  const allGroups = getNavGroupsForRole(role, notificationCount);

  // Determinar si la sección activa está en los items del bottom nav
  const isBottomActive = bottomItems.some(item => item.id === section);
  const moreHasBadge = moreGroups.some(group => group.items.some(item => item.badge !== undefined));

  if (isFocusMode) return null;

  return (
    <>
      {/* 1. BARRA DE NAVEGACIÓN INFERIOR FLOTANTE (Móvil & Tablet < lg) */}
      <nav aria-label="Navegación móvil inferior" className="edc-bottom-nav edc-chrome">
        {bottomItems.map(item => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMobileMoreOpen(false);
              }}
              aria-label={item.badge !== undefined ? `${item.label}, ${item.badge} sin leer` : item.label}
              aria-current={isActive ? "page" : undefined}
              className="edc-bottom-nav__item"
            >
              <span className="edc-bottom-nav__icon">
                <NavIcon item={item} />
                {item.badge !== undefined && <span aria-hidden="true" className="edc-bottom-nav__dot" />}
              </span>
              <span className="edc-bottom-nav__label">{item.label}</span>
            </button>
          );
        })}

        {/* Botón "Más" para desplegar los módulos complementarios */}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          aria-label="Más opciones"
          aria-current={!isBottomActive ? "page" : undefined}
          className="edc-bottom-nav__item"
        >
          <span className="edc-bottom-nav__icon">
            <MoreHorizontal aria-hidden="true" />
            {moreHasBadge && <span aria-hidden="true" className="edc-bottom-nav__dot" />}
          </span>
          <span className="edc-bottom-nav__label">Más</span>
        </button>
      </nav>

      {/* 2. SHEET INFERIOR: MENÚ "MÁS" */}
      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <SheetContent
          side="bottom"
          className="edc-nav rounded-t-3xl border-t border-sidebar-border bg-sidebar p-5 text-sidebar-foreground max-h-[80vh] overflow-y-auto"
        >
          <SheetHeader className="text-left pb-3 border-b border-sidebar-border pr-8">
            <SheetTitle className="text-base font-bold text-sidebar-foreground">
              Más opciones · {ROLE_LABELS[role]}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {moreGroups.map(group => (
              <div key={group.key} className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-sidebar-muted-foreground">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSection(item.id);
                          setMobileMoreOpen(false);
                        }}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                          isActive
                            ? "border-sidebar-active-foreground bg-sidebar-active text-sidebar-active-foreground"
                            : "border-sidebar-border bg-sidebar-accent text-sidebar-foreground/85 hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Cambio rápido de rol demo */}
            <div className="pt-3 border-t border-sidebar-border">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-sidebar-muted-foreground">
                Cambiar vista demo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["admin", "teacher", "student", "guardian"] as EduRole[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onRoleChange(option);
                      setMobileMoreOpen(false);
                    }}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition cursor-pointer ${
                      role === option
                        ? "border-sidebar-active-foreground bg-sidebar-active font-bold text-sidebar-active-foreground"
                        : "border-sidebar-border text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    {ROLE_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 3. DRAWER LATERAL: MENÚ HAMBURGUESA MÓVIL */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="edc-nav w-[280px] border-sidebar-border bg-sidebar p-5 text-sidebar-foreground">
          <SheetHeader className="text-left pb-4 border-b border-sidebar-border pr-8">
            <div className="flex items-center gap-3">
              <div className="edc-logo" aria-hidden="true">
                <div className="edc-logo__glyph" />
              </div>
              <div>
                <SheetTitle className="text-[15px] font-bold tracking-[0.14em] text-sidebar-foreground">
                  EDUCORE
                </SheetTitle>
                <p className="text-xs text-sidebar-muted-foreground">{schoolName}</p>
              </div>
            </div>
          </SheetHeader>

          {/* Navegación por grupos completa */}
          <div className="mt-5 space-y-4 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
            {allGroups.map(group => (
              <div key={group.key} className="space-y-1">
                <p className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-sidebar-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = section === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSection(item.id);
                          setMobileOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                          isActive
                            ? "bg-sidebar-active font-semibold text-sidebar-active-foreground shadow-xs"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            isActive ? "text-sidebar-active-foreground" : "text-sidebar-muted-foreground"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--edc-primary)] px-1 text-xs font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer del Drawer Móvil */}
          <div className="absolute bottom-4 inset-x-5 border-t border-sidebar-border pt-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-sidebar-foreground">
                {ROLE_LABELS[role]}
              </p>
              <p className="truncate text-xs text-sidebar-muted-foreground">{schoolName}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onLogout();
              }}
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
