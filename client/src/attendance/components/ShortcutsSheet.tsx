/** Hoja de referencia de atajos: la asistencia se toma sin soltar el teclado. */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUPS: Array<{ title: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    title: "Estados del estudiante",
    items: [
      { keys: ["P"], label: "Presente" },
      { keys: ["A"], label: "Ausente" },
      { keys: ["T"], label: "Tardanza" },
      { keys: ["E"], label: "Excusa" },
      { keys: ["Enter"], label: "Marcar presente" },
      { keys: ["Supr", "⌫"], label: "Volver a pendiente" },
    ],
  },
  {
    title: "Navegación",
    items: [
      { keys: ["↑", "↓"], label: "Estudiante anterior / siguiente" },
      { keys: ["Tab", "⇧ Tab"], label: "Siguiente / anterior estudiante (y salir al final)" },
      { keys: ["/"], label: "Buscar estudiante" },
      { keys: ["?"], label: "Abrir esta ayuda" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { keys: ["Ctrl", "Z"], label: "Deshacer el último cambio" },
      { keys: ["⌘", "Z"], label: "Deshacer en macOS" },
    ],
  },
];

export function ShortcutsSheet({ open, onOpenChange }: ShortcutsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-[420px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Atajos del panel de asistencia</DialogTitle>
          <DialogDescription className="text-[12px]">
            Los cambios se aplican al instante y se guardan solos en segundo plano. Al registrar a un
            estudiante pendiente, el foco avanza al siguiente.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-1 space-y-3">
          {GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                {group.title}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {group.items.map(item => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-[12px]"
                  >
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map(key => (
                        <span key={key} className="kbd">
                          {key}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
