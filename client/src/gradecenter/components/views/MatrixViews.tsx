import { Info, Keyboard, MousePointerClick, MoveHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MatrixCanvas } from "../matrix/MatrixCanvas";
import { useGradeCenter } from "../../state/GradeCenterContext";
import { LEVELS, LEVEL_ORDER } from "../../domain/scale";

/** Vista Estándar: el equilibrio por defecto entre información y legibilidad. */
export function StandardView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MatrixCanvas />
    </div>
  );
}

/** Vista Compacta: máxima densidad para grupos con muchas evaluaciones. */
export function CompactView() {
  const { dataset } = useGradeCenter();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/6 px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MoveHorizontal className="size-3" />
          Densidad compacta: {dataset.evaluations.length} evaluaciones caben en mucho menos espacio.
        </span>
        <span className="opacity-40">·</span>
        <span>Los encabezados se abrevian solos; pasa el cursor para ver el detalle completo.</span>
      </div>
      <MatrixCanvas densityOverride="compact" />
    </div>
  );
}

/** Leyenda de la escala institucional: el color refuerza, nunca sustituye. */
export function ScaleLegend({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="gc-label text-[9px]">Escala institucional</span>
        {LEVEL_ORDER.slice()
          .reverse()
          .map((level) => (
            <Tooltip key={level}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: LEVELS[level].color,
                      boxShadow: `0 0 8px ${LEVELS[level].color}`,
                    }}
                  />
                  <span className="gc-num">{LEVELS[level].range}</span>
                  <span>{LEVELS[level].label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56">
                <div className="text-[11px] font-semibold">
                  {LEVELS[level].label} · {LEVELS[level].range}
                </div>
                <p className="mt-0.5 text-[10px] opacity-85">{LEVELS[level].description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
    </div>
  );
}

export function MatrixHints() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Keyboard className="size-3" />
        Escribe la nota,{" "}
        <kbd className="gc-num rounded border border-white/12 bg-white/6 px-1">Enter</kbd> baja,{" "}
        <kbd className="gc-num rounded border border-white/12 bg-white/6 px-1">Tab</kbd> avanza
      </span>
      <span className="flex items-center gap-1.5">
        <MousePointerClick className="size-3" />
        Doble clic para editar
      </span>
      <span className="flex items-center gap-1.5">
        <Info className="size-3" />
        Arrastra el borde de una columna para ajustar su ancho
      </span>
    </div>
  );
}