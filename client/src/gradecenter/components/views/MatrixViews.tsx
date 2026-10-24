import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MatrixCanvas } from "../matrix/MatrixCanvas";
import { LEVELS, LEVEL_ORDER } from "../../domain/scale";

/** Vista Planilla: la matriz de calificaciones. */
export function StandardView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MatrixCanvas />
    </div>
  );
}

/** Leyenda de la escala institucional: el color refuerza, nunca sustituye. */
export function ScaleLegend({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="gc-label text-xs">Escala institucional</span>
        {LEVEL_ORDER.slice()
          .reverse()
          .map((level) => (
            <Tooltip key={level}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                <div className="text-xs font-semibold">
                  {LEVELS[level].label} · {LEVELS[level].range}
                </div>
                <p className="mt-0.5 text-xs opacity-85">{LEVELS[level].description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
    </div>
  );
}
