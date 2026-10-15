import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Calificar sin soltar el teclado",
    items: [
      { keys: ["0-9"], label: "Escribe la nota directamente en la celda activa" },
      { keys: ["Enter"], label: "Confirma y baja al siguiente estudiante" },
      { keys: ["Tab"], label: "Confirma y avanza a la siguiente evaluación" },
      { keys: ["Shift", "Tab"], label: "Confirma y vuelve a la evaluación anterior" },
      { keys: ["Esc"], label: "Cancela la edición sin guardar" },
      { keys: ["Backspace"], label: "Deja la evaluación como pendiente" },
      { keys: ["Delete"], label: "Limpia la selección de notas" },
    ],
  },
  {
    title: "Navegar",
    items: [
      { keys: ["↑", "↓", "←", "→"], label: "Moverse por la matriz sin entrar en edición" },
      { keys: ["F2"], label: "Editar la celda activa" },
      { keys: ["Doble clic"], label: "Editar cualquier celda" },
      { keys: ["Shift", "clic"], label: "Seleccionar un rango de celdas" },
      { keys: ["Ctrl/Cmd", "clic"], label: "Agregar o quitar celdas de la selección" },
      { keys: ["Esc"], label: "Salir del modo enfoque" },
    ],
  },
  {
    title: "Selección y portapapeles",
    items: [
      { keys: ["Checkbox"], label: "Seleccionar todos los visibles o una fila" },
      { keys: ["Ctrl/Cmd", "C"], label: "Copiar notas como tabla" },
      { keys: ["Ctrl/Cmd", "V"], label: "Previsualizar pegado desde Excel o Sheets" },
      { keys: ["Ctrl/Cmd", "Z"], label: "Deshacer la última edición local" },
      { keys: ["Ctrl/Cmd", "Y"], label: "Rehacer la edición local" },
    ],
  },
  {
    title: "Sesión de calificación",
    items: [
      { keys: ["Enfoque"], label: "La matriz ocupa toda la pantalla mientras calificas" },
      { keys: ["Análisis"], label: "Abre el panel contextual del grupo, la evaluación o el estudiante" },
      { keys: ["Autosave"], label: "Guardando → Guardado local, sin interrumpirte" },
    ],
  },
];

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl rounded-3xl border-white/10">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            Calificar rápido, sin ratón
          </DialogTitle>
          <DialogDescription>
            El Grade Center está diseñado para jornadas largas de calificación: toda la matriz se
            recorre con el teclado y nunca te quedas atrapado dentro de una celda.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-4 md:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-white/8 bg-white/3 p-3">
              <div className="gc-label mb-2 text-[9px]">{group.title}</div>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2">
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="gc-num rounded-md border border-white/12 bg-white/6 px-1.5 py-0.5 text-[10px] font-medium text-foreground/90"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{item.label}</span>
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
