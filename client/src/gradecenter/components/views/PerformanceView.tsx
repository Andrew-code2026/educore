import { Target } from "lucide-react";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { GroupDetail } from "../insights/GroupDetail";
import { ScaleLegend } from "./MatrixViews";

/**
 * Vista Desempeño.
 *
 * Es la vista específica donde el análisis vive a pantalla completa. Sigue
 * siendo la misma información de la matriz: niveles, tendencias, atención y
 * pendientes, sin gráficas decorativas.
 */
export function PerformanceView() {
  const { dataset, analytics } = useGradeCenter();

  return (
    <div className="gc-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="glass flex size-11 items-center justify-center rounded-2xl text-[var(--gc-cobalt)]">
              <Target className="size-5" />
            </span>
            <div>
              <div className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                Desempeño del grupo
              </div>
              <div className="text-xs text-muted-foreground">
                {dataset.course} · {dataset.subject} · {dataset.evaluations.length} evaluaciones ·{" "}
                {dataset.students.length} estudiantes
              </div>
            </div>
          </div>
          <ScaleLegend className="glass-soft max-w-md rounded-2xl p-2.5" />
        </div>

        <div className="glass gc-rise rounded-3xl p-4">
          <GroupDetail layout="wide" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="glass-soft rounded-2xl p-3">
            <div className="gc-label mb-2 text-xs">Cómo leer esta vista</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Todo lo que ves aquí sale del mismo conjunto de datos que la matriz: no hay módulos
              paralelos ni cifras que se calculen aparte. Si calificas una nota en la vista estándar,
              estas métricas cambian al instante.
            </p>
          </div>
          <div className="glass-soft rounded-2xl p-3">
            <div className="gc-label mb-2 text-xs">Inteligencia visual, no dashboard</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              El análisis no invade la pantalla principal de calificación: aparece aquí o en el panel
              contextual, según lo que el docente necesite en ese momento.
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {analytics.group.totalPending} notas pendientes · {analytics.group.attention.length} estudiantes en
          atención · {analytics.group.declining.length} en descenso
        </div>
      </div>
    </div>
  );
}