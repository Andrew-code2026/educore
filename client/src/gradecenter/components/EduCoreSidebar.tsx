import {
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GradeCenterMark } from "./Brand";
import type { ViewId } from "../types";

const NAV_ITEMS = [
  { label: "Grade Center", icon: ClipboardList, destination: "home" as const },
];

type NavDestination = "home" | ViewId;

export function EduCoreSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  section,
  onNavigate,
  onUnavailable,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  section: NavDestination;
  onNavigate: (destination: NavDestination) => void;
  onUnavailable: (label: string) => void;
}) {
  return (
    <>
      <aside
        aria-label="Navegación principal de EduCore"
        className={cn(
          "fixed inset-y-0 left-0 z-[70] hidden flex-col border-r border-white/8 transition-[width,transform] duration-300 lg:flex",
          "glass-strong",
          collapsed ? "w-[72px]" : "w-[250px]",
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} section={section} onNavigate={onNavigate} onUnavailable={onUnavailable} />
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={onMobileClose}
            className="fixed inset-0 z-[75] bg-[oklch(0.08_0.02_266/45%)] backdrop-blur-[2px] lg:hidden"
          />
          <aside
            aria-label="Navegación móvil de EduCore"
            className="glass-strong fixed inset-y-0 left-0 z-[80] flex w-[280px] flex-col border-r border-white/10 lg:hidden"
          >
            <div className="flex items-center justify-between px-4 py-4">
              <SidebarBrand />
              <button
                type="button"
                aria-label="Cerrar navegación"
                onClick={onMobileClose}
                className="flex size-8 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav collapsed={false} onNavigate={(destination) => { onNavigate(destination); onMobileClose(); }} section={section} onUnavailable={onUnavailable} />
          </aside>
        </>
      )}
    </>
  );
}

function SidebarContent({ collapsed, onToggle, section, onNavigate, onUnavailable }: { collapsed: boolean; onToggle: () => void; section: NavDestination; onNavigate: (destination: NavDestination) => void; onUnavailable: (label: string) => void }) {
  return (
    <>
      <div className={cn("flex items-center border-b border-white/8 py-4", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
        {collapsed ? <GradeCenterMark className="size-9" /> : <SidebarBrand />}
      </div>
      <SidebarNav collapsed={collapsed} section={section} onNavigate={onNavigate} onUnavailable={onUnavailable} />
      <div className={cn("mt-auto border-t border-white/8 p-3", collapsed ? "flex justify-center" : "")}> 
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className={cn(
            "flex items-center rounded-xl border border-white/8 bg-white/4 text-xs text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground",
            collapsed ? "size-9 justify-center" : "w-full gap-2 px-2.5 py-2",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Colapsar sidebar</span>}
        </button>
      </div>
    </>
  );
}

function SidebarBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <GradeCenterMark className="size-9 shrink-0" />
      <div className="min-w-0">
        <div className="font-display text-[13px] font-semibold tracking-tight text-foreground">EduCore</div>
        <div className="mt-0.5 truncate text-xs tracking-[0.13em] text-muted-foreground uppercase">Workspace académico</div>
      </div>
    </div>
  );
}

function SidebarNav({ collapsed, section, onNavigate, onUnavailable }: { collapsed: boolean; section: NavDestination; onNavigate: (destination: NavDestination) => void; onUnavailable: (label: string) => void }) {
  return (
    <nav className={cn("space-y-1 py-4", collapsed ? "px-2" : "px-3")}>
      <div className={cn("gc-label mb-2 text-xs", collapsed ? "text-center" : "px-2")}>{collapsed ? "·" : "Navegación"}</div>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.destination === "home";
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.destination)}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex w-full items-center rounded-xl transition-all",
              collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
                active
                ? "border border-[var(--gc-cobalt)]/30 bg-[var(--gc-cobalt)]/14 text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/8%)]"
                : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-[var(--gc-cobalt)]")} />
            {!collapsed && <span className="text-xs font-medium">{item.label}</span>}
            {!collapsed && active && <span className="ml-auto size-1.5 rounded-full bg-[var(--gc-cobalt)] shadow-[0_0_10px_var(--gc-cobalt)]" />}
          </button>
        );
      })}
      <div className="my-3 border-t border-white/6" />
      <button
        type="button"
        onClick={() => onUnavailable("Configuración")}
        title={collapsed ? "Configuración" : undefined}
        className={cn(
          "flex w-full items-center rounded-xl text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground",
          collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
        )}
      >
        <Settings2 className="size-4 shrink-0" />
        {!collapsed && <span className="text-xs font-medium">Configuración</span>}
      </button>
    </nav>
  );
}
