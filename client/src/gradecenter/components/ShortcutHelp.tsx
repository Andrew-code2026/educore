import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Calificar",
    items: [
      { keys: ["0-9"], label: "Escribe la nota en la celda activa" },
      { keys: ["45"], label: "Dos cifras se leen como décimas: 4.5" },
      { keys: ["Enter"], label: "Guarda y baja al siguiente estudiante" },
      { keys: ["Tab"], label: "Guarda y pasa a la siguiente evaluación" },
      { keys: ["Esc"], label: "Cancela la edición" },
      { keys: ["Supr"], label: "Deja la nota pendiente" },
    ],
  },
  {
    title: "Moverse",
    items: [
      { keys: ["↑", "↓", "←", "→"], label: "Recorre la planilla" },
      { keys: ["F2"], label: "Edita la celda activa" },
      { keys: ["Doble clic"], label: "Edita cualquier celda" },
      { keys: ["Shift", "clic"], label: "Selecciona un rango" },
      { keys: ["Ctrl", "clic"], label: "Agrega celdas a la selección" },
    ],
  },
  {
    title: "Portapapeles",
    items: [
      { keys: ["Ctrl", "C"], label: "Copia las notas seleccionadas" },
      { keys: ["Ctrl", "V"], label: "Pega desde Excel o Sheets (con vista previa)" },
      { keys: ["Ctrl", "Z"], label: "Deshace" },
      { keys: ["Ctrl", "Y"], label: "Rehace" },
    ],
  },
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong rounded-2xl border-white/10 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Toda la planilla se puede calificar sin soltar el teclado.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-4 md:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">{group.title}</div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2">
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="gc-num rounded-md border border-white/12 bg-white/6 px-1.5 py-0.5 text-xs font-medium text-foreground/90"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
