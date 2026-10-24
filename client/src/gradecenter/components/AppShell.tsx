import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter, useGradeCenterActions } from "../state/GradeCenterContext";
import { TopRail } from "./TopRail";
import { ControlStrip } from "./ControlStrip";
import { ShortcutHelp } from "./ShortcutHelp";
import { ContextPanel } from "./insights/ContextPanel";
import { StandardView } from "./views/MatrixViews";
import { StudentView } from "./views/StudentView";
import { EvaluationsView } from "./views/EvaluationsView";
import { PerformanceView } from "./views/PerformanceView";
import { DbaView } from "./views/DbaView";
import { EduCoreSidebar } from "./EduCoreSidebar";
import { LandingView } from "./LandingView";
import { GradeCenterDialogsProvider } from "./dialogs/DialogsProvider";
import { useOptionalShellContext } from "@/components/shell/ShellContext";
import type { ViewId } from "../types";
import { toast } from "sonner";

/**
 * Cambiar de vista es instantáneo: sin animación de entrada (se percibía como
 * una recarga) y la planilla se mantiene montada, así al volver conserva su
 * scroll y la celda activa sin reconstruir toda la matriz.
 */
function ViewRouter() {
  const { preferences, dataset } = useGradeCenter();
  // Una preferencia guardada en "dba" no debe abrir una vista vacía.
  const raw = preferences.view === "dba" && dataset.dba.length === 0 ? "standard" : preferences.view;
  const view = raw === "compact" ? "standard" : raw;

  const onMatrix = view === "standard";

  // Ambas capas ocupan el mismo espacio. La planilla oculta usa `gc-layer-hidden`
  // (content-visibility): el navegador guarda su render y volver cuesta ~1 ms.
  return (
    <div className="relative min-h-0 flex-1">
      <div className={cn("absolute inset-0 flex flex-col", !onMatrix && "gc-layer-hidden")} inert={!onMatrix} aria-hidden={!onMatrix || undefined}>
        <StandardView />
      </div>
      {!onMatrix && (
        <div className="absolute inset-0 flex flex-col">
          {view === "student" && <StudentView />}
          {view === "evaluations" && <EvaluationsView />}
          {view === "performance" && <PerformanceView />}
          {view === "dba" && <DbaView />}
        </div>
      )}
    </div>
  );
}

/** Atajos globales de la planilla. Nunca interfieren con campos, diálogos ni popovers. */
function useWorkspaceShortcuts(enabled: boolean, focus: boolean, onOpenHelp: () => void) {
  const { setFocusMode, copySelection, readPaste, undo, redo } = useGradeCenterActions();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;

      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      if (isFormField) return;

      const inGrid = Boolean(target?.closest('[role="grid"]'));
      const onPage = !target || target === document.body;
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && (inGrid || onPage)) {
        const key = event.key.toLowerCase();
        // Si el docente seleccionó texto, se respeta la copia nativa del navegador.
        if (key === "c" && !window.getSelection()?.toString()) {
          event.preventDefault();
          void copySelection();
        } else if (key === "v" && onPage) {
          // En una celda el evento nativo `paste` ya abre la vista previa.
          event.preventDefault();
          void readPaste();
        } else if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          event.preventDefault();
          redo();
        }
        return;
      }

      if (event.key === "Escape" && focus && !inGrid) {
        setFocusMode(false);
        return;
      }
      if (event.key === "?") onOpenHelp();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, focus, setFocusMode, copySelection, readPaste, undo, redo, onOpenHelp]);
}

export function AppShell({
  embedded = true,
  isSwitchingAssignment = false,
}: {
  embedded?: boolean;
  /** Se conserva por compatibilidad: la salida del módulo la gestiona el shell. */
  onBack?: () => void;
  isSwitchingAssignment?: boolean;
} = {}) {
  const shellContext = useOptionalShellContext();
  const { dataset, availableAssignments, preferences } = useGradeCenter();
  const { setFocusMode, setView, setActiveCell } = useGradeCenterActions();
  const [helpOpen, setHelpOpen] = useState(false);
  const [screen, setScreen] = useState<"landing" | "workspace">("landing");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("educore.gradecenter.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const focus = preferences.focusMode;
  const isLanding = screen === "landing";

  const openHelp = useCallback(() => setHelpOpen(true), []);
  useWorkspaceShortcuts(!isLanding, focus, openHelp);

  // El modo enfoque también colapsa el sidebar exterior de EduCore.
  useEffect(() => {
    shellContext?.setIsFocusMode(!isLanding && focus);
  }, [focus, isLanding, shellContext]);

  useEffect(() => () => shellContext?.setIsFocusMode(false), [shellContext]);

  // Encabezado institucional: en la selección no se fija un salón engañoso;
  // dentro de una planilla se muestra el curso, materia y periodo reales.
  useEffect(() => {
    if (!shellContext) return;
    const role = shellContext.activeRole;
    const title = role === "student" ? "Mis Calificaciones" : role === "guardian" ? "Rendimiento" : "Grade Center";

    if (isLanding) {
      const count = availableAssignments?.length ?? 0;
      shellContext.setModuleContext({
        title,
        subtitle: "Selección de planilla académica",
        breadcrumbs: [{ label: "Académico" }, { label: title, isCurrent: true }],
        contextPills:
          count > 0 ? [{ label: `${count} ${count === 1 ? "planilla asignada" : "planillas asignadas"}`, tone: "primary" }] : [],
      });
    } else {
      shellContext.setModuleContext({
        title,
        subtitle: `${dataset.course} · ${dataset.subject}`,
        breadcrumbs: [
          { label: "Académico" },
          { label: "Mis planillas" },
          { label: `${dataset.course} · ${dataset.subject}`, isCurrent: true },
        ],
        contextPills: [
          { label: `${dataset.course} · ${dataset.subject}`, tone: "primary" },
          { label: dataset.period, tone: "default" },
        ],
      });
    }
  }, [shellContext, isLanding, dataset.course, dataset.subject, dataset.period, availableAssignments?.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem("educore.gradecenter.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
    } catch {
      /* almacenamiento no disponible */
    }
  }, [sidebarCollapsed]);

  const openMatrix = (view: ViewId = "standard") => {
    setScreen("workspace");
    setFocusMode(false);
    setView(view);
    setActiveCell({ row: 0, col: 0 });
    window.scrollTo({ top: 0, left: 0 });
  };

  const backToLanding = useCallback(() => {
    setFocusMode(false);
    setScreen("landing");
  }, [setFocusMode]);

  return (
    <div
      className={cn(
        "gc-workspace-root relative flex h-full w-full flex-col overflow-hidden transition-[padding] duration-300",
        !embedded && "lg:pl-[var(--gc-sidebar-width)]",
      )}
      data-screen={screen}
      style={!embedded ? ({ "--gc-sidebar-width": sidebarCollapsed ? "72px" : "250px" } as CSSProperties) : undefined}
    >
      <GradeCenterDialogsProvider>
        {!embedded && (
          <EduCoreSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
            section={isLanding ? "home" : preferences.view}
            onNavigate={(destination) => {
              setMobileSidebarOpen(false);
              if (destination === "home") setScreen("landing");
              else {
                setScreen("workspace");
                setView(destination);
              }
            }}
            onUnavailable={(label) => toast.info(`${label} todavía no está disponible.`)}
          />
        )}

        {!isLanding && <TopRail onOpenHelp={openHelp} onBack={backToLanding} />}
        {!isLanding && !focus && <ControlStrip />}

        <main className="relative flex min-h-0 flex-1 flex-col">
          {isLanding ? (
            <LandingView onOpenMatrix={openMatrix} />
          ) : (
            <>
              {isSwitchingAssignment && (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-none absolute top-3 right-4 z-30 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--card)] px-3 py-1.5 text-xs font-medium shadow-lg"
                >
                  <Loader2 className="size-3.5 animate-spin text-[var(--gc-cobalt)]" />
                  Abriendo planilla…
                </div>
              )}
              <ViewRouter />
              <ContextPanel />
            </>
          )}
        </main>

        <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </GradeCenterDialogsProvider>
    </div>
  );
}
