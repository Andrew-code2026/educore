import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGradeCenter } from "../state/GradeCenterContext";
import { TopRail } from "./TopRail";
import { ControlStrip } from "./ControlStrip";
import { ShortcutHelp } from "./ShortcutHelp";
import { ContextPanel } from "./insights/ContextPanel";
import { CompactView, MatrixHints, ScaleLegend, StandardView } from "./views/MatrixViews";
import { StudentView } from "./views/StudentView";
import { EvaluationsView } from "./views/EvaluationsView";
import { PerformanceView } from "./views/PerformanceView";
import { DbaView } from "./views/DbaView";
import { VIEW_OPTIONS } from "./ViewSwitcher";
import { EduCoreSidebar } from "./EduCoreSidebar";
import { LandingView } from "./LandingView";
import { useOptionalShellContext } from "@/components/shell/ShellContext";
import type { ViewId } from "../types";
import { toast } from "sonner";

const DENSITY_LABEL: Record<string, string> = {
  compact: "Densa",
  standard: "Estándar",
  cozy: "Cómoda",
};

function ViewRouter() {
  const { preferences } = useGradeCenter();

  const content = (() => {
    switch (preferences.view) {
      case "compact":
        return <CompactView />;
      case "student":
        return <StudentView />;
      case "evaluations":
        return <EvaluationsView />;
      case "performance":
        return <PerformanceView />;
      case "dba":
        return <DbaView />;
      case "standard":
      default:
        return <StandardView />;
    }
  })();

  return (
    <motion.div
      key={preferences.view}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {content}
    </motion.div>
  );
}

export function AppShell({
  embedded = true,
  onBack,
  isSwitchingAssignment = false,
}: {
  embedded?: boolean;
  onBack?: () => void;
  isSwitchingAssignment?: boolean;
} = {}) {
  const shellContext = useOptionalShellContext();
  const {
    dataset,
    availableAssignments,
    preferences,
    setFocusMode,
    setView,
    setActiveCell,
     students,
    analytics,
    copySelection,
    readPaste,
    undo,
    redo,
    clearSelectedGrades,
    pastePreview,
    applyPastePreview,
    cancelPastePreview,
  } = useGradeCenter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [screen, setScreen] = useState<"landing" | "workspace">("landing");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("educore.gradecenter.sidebar") === "collapsed";
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const focus = preferences.focusMode;
  const isMatrixView = preferences.view === "standard" || preferences.view === "compact";
  const isLanding = screen === "landing";

  // Sincronizar el modo enfoque con el shell global de EduCore para colapsar el sidebar exterior
  useEffect(() => {
    if (shellContext) {
      shellContext.setIsFocusMode(!isLanding && focus);
    }
  }, [focus, isLanding, shellContext]);

  useEffect(() => {
    return () => {
      shellContext?.setIsFocusMode(false);
    };
  }, [shellContext]);

  // Sincronizar las píldoras contextuales del encabezado institucional con el estado real:
  // En la pantalla de selección de planillas no se muestra un salón fijo engañoso;
  // al entrar a una planilla se muestra el curso, materia y periodo reales.
  useEffect(() => {
    if (!shellContext) return;
    const role = shellContext.activeRole;
    const title = role === "student" ? "Mis Calificaciones" : role === "guardian" ? "Rendimiento" : "Calificaciones";

    if (isLanding) {
      const count = availableAssignments?.length ?? 0;
      shellContext.setModuleContext({
        title,
        subtitle: "Selección de planilla académica",
        breadcrumbs: [
          { label: "Académico" },
          { label: title, isCurrent: true },
        ],
        contextPills: count > 0
          ? [{ label: `${count} ${count === 1 ? "planilla asignada" : "planillas asignadas"}`, tone: "primary" }]
          : [],
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

  const openMatrix = (view: ViewId = "standard") => {
    setScreen("workspace");
    setFocusMode(false);
    setView(view);
    setActiveCell({ row: 0, col: 0 });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const resetScroll = () => {
      const roots = document.querySelectorAll<HTMLElement>(".gc-workspace-root, .gc-scroll, main, [role='grid']");
      roots.forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    };
    resetScroll();
    requestAnimationFrame(resetScroll);
    setTimeout(resetScroll, 50);
  };

  useEffect(() => {
    if (screen === "workspace") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const resetScroll = () => {
        const roots = document.querySelectorAll<HTMLElement>(".gc-workspace-root, .gc-scroll, main, [role='grid']");
        roots.forEach((el) => {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        });
      };
      resetScroll();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 50);
      setTimeout(resetScroll, 150);
    }
  }, [screen]);

  const handleToggleSidebar = () => {
    if (embedded && shellContext) {
      shellContext.setMobileMoreOpen((prev) => !prev);
    } else {
      setMobileSidebarOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    window.localStorage.setItem("educore.gradecenter.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      const isGridCell = target?.getAttribute("role") === "gridcell";
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && !isFormField) {
        const key = event.key.toLowerCase();
        if (key === "c") { event.preventDefault(); void copySelection(); return; }
        if (key === "v") {
          if (isGridCell) return;
          event.preventDefault(); void readPaste(); return;
        }
        if (key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
        if (key === "y") { event.preventDefault(); redo(); return; }
      }
      if ((event.key === "Delete" || event.key === "Backspace") && isGridCell) {
        event.preventDefault(); clearSelectedGrades(); return;
      }
      if (event.key === "Escape" && pastePreview) {
        event.preventDefault(); cancelPastePreview(); return;
      }
      if (event.key === "Escape" && focus) {
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === "INPUT" || active.getAttribute("role") === "gridcell")) return;
        setFocusMode(false);
      }
      if (event.key === "?" && !isFormField) {
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus, setFocusMode, copySelection, readPaste, undo, redo, clearSelectedGrades, pastePreview, cancelPastePreview]);

  return (
    <div
      className={cn(
        "gc-workspace-root relative flex h-full w-full flex-col overflow-hidden transition-[padding] duration-300",
        !embedded && "lg:pl-[var(--gc-sidebar-width)]",
      )}
      style={!embedded ? ({ "--gc-sidebar-width": sidebarCollapsed ? "72px" : "250px" } as CSSProperties) : undefined}
    >
      {!embedded && (
        <EduCoreSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          section={screen === "landing" ? "home" : preferences.view}
          onNavigate={(destination) => {
            setMobileSidebarOpen(false);
            if (destination === "home") setScreen("landing");
            else { setScreen("workspace"); setView(destination); }
          }}
          onUnavailable={(label) => toast.info(`${label} todavía no está disponible en este prototipo.`)}
        />
      )}

      {!isLanding && (
        <TopRail
          onOpenHelp={() => setHelpOpen(true)}
          onToggleSidebar={handleToggleSidebar}
          onOpenLanding={() => setScreen("landing")}
          onBack={() => {
            if (screen === "workspace") {
              setScreen("landing");
            } else if (onBack) {
              onBack();
            }
          }}
        />
      )}
      {!isLanding && <ControlStrip />}

      <main className="relative flex min-h-0 flex-1 flex-col">
        {screen === "landing" ? (
          <LandingView onOpenMatrix={openMatrix} />
        ) : (
          <>
            {isSwitchingAssignment && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute top-3 right-4 z-30 inline-flex items-center gap-2 rounded-xl border border-[var(--gc-cobalt)]/35 bg-[var(--card)]/95 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md"
              >
                <Loader2 className="size-3.5 animate-spin text-[var(--gc-cobalt)]" />
                <span>Abriendo planilla…</span>
              </div>
            )}
            <ViewRouter />
          </>
        )}
        {!isLanding && <ContextPanel />}
      </main>

      {/* Barra de estado: leyenda de la escala y pistas de uso */}
      {!isLanding && (
        <footer className="glass-soft relative z-20 flex h-8 shrink-0 items-center gap-3 border-t border-white/8 px-3 text-xs">
          {!focus && (
            <span className="hidden items-center gap-1.5 text-muted-foreground md:flex">
              <span className="gc-label text-xs">Vista</span>
              <span className="text-foreground/90">
                {VIEW_OPTIONS.find((option) => option.id === preferences.view)?.label}
              </span>
              <span className="opacity-40">·</span>
              <span className="gc-label text-xs">Densidad</span>
              <span className="text-foreground/90">{DENSITY_LABEL[preferences.density]}</span>
              <span className="opacity-40">·</span>
              <span className="gc-num">
                {students.length} de {analytics.students.length} estudiantes visibles
              </span>
            </span>
          )}

          <div className="flex-1" />

          {isMatrixView ? <MatrixHints /> : <ScaleLegend />}
        </footer>
      )}

      {pastePreview && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
          <div className="glass-strong pointer-events-auto w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-white/12 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Vista previa de pegado</div>
                <p className="mt-1 text-xs text-muted-foreground">{pastePreview.rows.length} filas × {Math.max(...pastePreview.rows.map((row) => row.length))} columnas desde Excel o Sheets.</p>
              </div>
              <button type="button" onClick={cancelPastePreview} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-white/8">Esc</button>
            </div>
            <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-white/8 bg-black/10">
              <table className="w-full border-collapse text-xs"><tbody>{pastePreview.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{row.slice(0, 8).map((value, colIndex) => <td key={colIndex} className="border-b border-r border-white/8 px-2 py-1.5 font-mono">{value || "—"}</td>)}</tr>)}</tbody></table>
            </div>
            {pastePreview.error && <div role="alert" className="mt-2 rounded-xl border border-[var(--gc-bajo)]/30 bg-[var(--gc-bajo)]/8 px-3 py-2 text-xs text-[var(--gc-bajo)]">{pastePreview.error}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={cancelPastePreview} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/8">Cancelar</button>
              <button type="button" onClick={applyPastePreview} disabled={Boolean(pastePreview.error)} className="rounded-xl bg-[var(--gc-cobalt)]/25 px-3 py-1.5 text-xs font-semibold hover:bg-[var(--gc-cobalt)]/35 disabled:cursor-not-allowed disabled:opacity-40">Aplicar pegado</button>
            </div>
          </div>
        </div>
      )}

      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
