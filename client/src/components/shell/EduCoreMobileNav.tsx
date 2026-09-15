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

const storageUrl = (value: string | null | undefined): string | undefined =>
  value ? value.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment))).join("/") : undefined;

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
  } = useShellContext();

  const bottomItems = getMobileBottomNavItems(role, notificationCount);
  const moreGroups = getMoreNavGroups(role, notificationCount);
  const allGroups = getNavGroupsForRole(role, notificationCount);

  // Determinar si la sección activa está en los items del bottom nav
  const isBottomActive = bottomItems.some(item => item.id === section);

  return (
    <>
      {/* 1. BARRA DE NAVEGACIÓN INFERIOR FLOTANTE (Móvil & Tablet < lg) */}
      <nav
        aria-label="Navegación móvil inferior"
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 items-center rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-lg backdrop-blur-lg lg:hidden"
        style={{
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)",
        }}
      >
        {bottomItems.map(item => {
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
              aria-label={item.label}
              className={`relative flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-[var(--edc-secondary)] text-[var(--edc-primary)] font-bold shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-[var(--edc-primary)]" : "text-slate-400"}`} />
              <span className="truncate max-w-[64px]">{item.label}</span>
              {item.badge !== undefined && (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--edc-primary)] px-1 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Botón "Más" para desplegar los módulos complementarios */}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          aria-label="Más opciones"
          className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
            !isBottomActive
              ? "bg-[var(--edc-secondary)] text-[var(--edc-primary)] font-bold shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>Más</span>
        </button>
      </nav>

      {/* 2. SHEET INFERIOR: MENÚ "MÁS" */}
      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-slate-200 bg-white p-5 max-h-[80vh] overflow-y-auto"
        >
          <SheetHeader className="text-left pb-3 border-b border-slate-100 pr-8">
            <SheetTitle className="text-base font-bold text-slate-900">
              Más opciones · {ROLE_LABELS[role]}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {moreGroups.map(group => (
              <div key={group.key} className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                            ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)] text-[var(--edc-primary)]"
                            : "border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Cambio rápido de rol demo */}
            <div className="pt-3 border-t border-slate-100">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                        ? "border-[var(--edc-primary)] bg-[var(--edc-secondary)] font-bold text-[var(--edc-primary)]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
        <SheetContent side="left" className="w-[280px] bg-white p-5">
          <SheetHeader className="text-left pb-4 border-b border-slate-100 pr-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edc-secondary)] font-bold text-[var(--edc-primary)] shadow-xs">
                {school?.logoUrl ? (
                  <img
                    src={storageUrl(school.logoUrl)}
                    alt="Escudo institucional"
                    className="h-full w-full rounded-xl object-contain p-1"
                  />
                ) : (
                  "E"
                )}
              </div>
              <div>
                <SheetTitle className="text-sm font-bold text-slate-900">
                  EduCore
                </SheetTitle>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  School OS
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Navegación por grupos completa */}
          <div className="mt-5 space-y-4 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
            {allGroups.map(group => (
              <div key={group.key} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                            ? "bg-[var(--edc-secondary)] font-semibold text-[var(--edc-primary)] shadow-xs"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            isActive ? "text-[var(--edc-primary)]" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--edc-primary)] px-1 text-[9px] font-bold text-white">
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
          <div className="absolute bottom-4 inset-x-5 border-t border-slate-100 pt-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">
                {ROLE_LABELS[role]}
              </p>
              <p className="truncate text-[10px] text-slate-400">{schoolName}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onLogout();
              }}
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
