import { memo, useId, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, FileHeart, Loader2, Plus, Search, Users } from "lucide-react";
import { initialsOf, plural } from "@/analytics/landing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filterByName, PIAR_STATE_LABEL, type PiarCourseDetailModel, type PiarStudentInput, type PiarStudentRowModel } from "./model";
import { AnnexBars, EmptyCard, ErrorCard } from "./parts";
import "./piar.css";

interface PiarCourseProps {
  /** Grupo conocido desde la portada, para el encabezado mientras carga. */
  group: string;
  academicYear: string;
  backLabel: string;
  /** `null` mientras cargan los estudiantes. */
  model: PiarCourseDetailModel | null;
  error: boolean;
  creating: boolean;
  onBack: () => void;
  onRetry: () => void;
  onOpenRecord: (row: PiarStudentRowModel) => void;
  /** Rechaza si el servidor no creó el PIAR; el diálogo queda abierto. */
  onCreate: (student: PiarStudentInput) => Promise<void>;
}

/** Estudiantes del curso con PIAR y el avance de sus anexos. */
export function PiarCourse({ group, academicYear, backLabel, model, error, creating, onBack, onRetry, onOpenRecord, onCreate }: PiarCourseProps) {
  const [adding, setAdding] = useState(false);
  const rows = model?.rows ?? [];

  return (
    <div className="pia">
      <div aria-hidden="true" className="pia__glow pia__glow--a" />
      <div aria-hidden="true" className="pia__glow pia__glow--b" />

      <div className="pia__content pia-detail">
        <header className="pia-detail-header">
          <div className="pia-detail-header__intro">
            <button type="button" className="pia-btn pia-btn--outline" onClick={onBack}>
              <ArrowLeft aria-hidden="true" strokeWidth={1.9} />
              {backLabel}
            </button>
            <span className="pia-eyebrow">Año {academicYear}</span>
            <h1 className="pia-detail-header__title">
              PIAR <span className="pia-group pia-num">{group}</span>
            </h1>
            {model && (
              <p className="pia-detail-header__meta">
                <span className="pia-meta">
                  <Users aria-hidden="true" strokeWidth={1.9} />
                  {plural(rows.length + model.candidates.length, "matriculado", "matriculados")}
                </span>
                <span className="pia-num">{plural(rows.length, "estudiante con PIAR", "estudiantes con PIAR")}</span>
              </p>
            )}
          </div>
          {model && model.candidates.length > 0 && (
            <button type="button" className="pia-btn pia-btn--primary pia-btn--lg" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" strokeWidth={2.2} />
              Registrar estudiante
            </button>
          )}
        </header>

        {error ? (
          <ErrorCard title="No pudimos cargar los estudiantes" onRetry={onRetry} />
        ) : model ? (
          rows.length > 0 ? (
            <StudentList rows={rows} onOpen={onOpenRecord} />
          ) : (
            <EmptyCard
              icon={<FileHeart strokeWidth={1.9} />}
              title={model.candidates.length ? "Ningún estudiante tiene PIAR en este curso" : "Sin estudiantes matriculados"}
              action={
                model.candidates.length > 0 ? (
                  <button type="button" className="pia-btn pia-btn--outline" onClick={() => setAdding(true)}>
                    <Plus aria-hidden="true" strokeWidth={2} />
                    Registrar estudiante
                  </button>
                ) : undefined
              }
            >
              {model.candidates.length
                ? "Registra a los estudiantes que requieren ajustes razonables para diligenciar sus anexos."
                : "Los PIAR aparecerán cuando el curso tenga estudiantes con matrícula activa."}
            </EmptyCard>
          )
        ) : (
          <div aria-busy="true" aria-label="Cargando estudiantes" className="pia-surface pia-list">
            {[0, 1, 2].map(row => (
              <span key={row} className="pia-skeleton pia-skeleton--row" />
            ))}
          </div>
        )}
      </div>

      {model && (
        <AddStudentDialog
          open={adding}
          group={group}
          candidates={model.candidates}
          creating={creating}
          onOpenChange={setAdding}
          onCreate={async student => {
            await onCreate(student);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

const SEARCH_THRESHOLD = 6;

function StudentList({ rows, onOpen }: { rows: PiarStudentRowModel[]; onOpen: (row: PiarStudentRowModel) => void }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterByName(rows, query), [rows, query]);

  return (
    <section aria-label="Estudiantes con PIAR" className="pia-section">
      {rows.length >= SEARCH_THRESHOLD && (
        <label className="pia-search">
          <Search aria-hidden="true" strokeWidth={1.9} />
          <span className="pia-sr">Buscar estudiante</span>
          <input type="search" value={query} placeholder="Buscar estudiante" autoComplete="off" onChange={event => setQuery(event.target.value)} />
        </label>
      )}
      {visible.length > 0 ? (
        <ul aria-label="Estudiantes con PIAR" className="pia-surface pia-list">
          {visible.map(row => (
            <StudentRow key={row.recordId} row={row} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <p className="pia-no-results" role="status">
          Ningún estudiante coincide con “{query.trim()}”.
        </p>
      )}
    </section>
  );
}

const StudentRow = memo(function StudentRow({ row, onOpen }: { row: PiarStudentRowModel; onOpen: (row: PiarStudentRowModel) => void }) {
  return (
    <li>
      <button type="button" className="pia-student" aria-label={`Abrir el PIAR de ${row.name}`} onClick={() => onOpen(row)}>
        <span aria-hidden="true" className="pia-avatar">
          {initialsOf(row.name)}
        </span>
        <span className="pia-student__body">
          <span className="pia-student__name">{row.name}</span>
          <span className="pia-student__meta">
            <span className={cn("pia-state", `pia-state--${row.state}`)}>{PIAR_STATE_LABEL[row.state]}</span>
            {row.code && <span className="pia-num">{row.code}</span>}
            <span>
              Actualizado {row.updated}
              {row.updatedBy ? ` por ${row.updatedBy}` : ""}
            </span>
          </span>
        </span>
        <AnnexBars annexes={row.annexes} studentName={row.name} />
        <ChevronRight aria-hidden="true" strokeWidth={1.9} className="pia-chevron" />
      </button>
    </li>
  );
});

interface AddStudentDialogProps {
  open: boolean;
  group: string;
  candidates: PiarStudentInput[];
  creating: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (student: PiarStudentInput) => Promise<void>;
}

/** Elige un estudiante matriculado sin PIAR para abrirle uno. */
function AddStudentDialog({ open, group, candidates, creating, onOpenChange, onCreate }: AddStudentDialogProps) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const visible = useMemo(() => filterByName(candidates, query), [candidates, query]);
  const selected = candidates.find(student => student.studentId === selectedId) ?? null;

  const reset = () => {
    setQuery("");
    setSelectedId(null);
  };

  const submit = async () => {
    if (!selected) return;
    try {
      await onCreate(selected);
    } catch {
      // El aviso de error lo muestra quien crea el PIAR; el diálogo sigue abierto
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !creating && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-hidden rounded-2xl sm:max-w-lg" onCloseAutoFocus={reset}>
        <DialogHeader>
          <DialogTitle>Registrar estudiante en el PIAR</DialogTitle>
          <DialogDescription>
            Elige un estudiante de {group}. Se abrirá su PIAR con los datos que el colegio ya conoce para que diligencies los anexos.
          </DialogDescription>
        </DialogHeader>

        <label className="relative flex items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Buscar estudiante</span>
          <input
            id={`${ids}-search`}
            type="search"
            value={query}
            placeholder="Buscar por nombre o código"
            autoComplete="off"
            onChange={event => setQuery(event.target.value)}
            className="h-10 w-full rounded-full border border-input bg-transparent pl-9 pr-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>

        <div role="radiogroup" aria-label="Estudiantes sin PIAR" className="-mx-1 flex max-h-72 flex-col gap-1 overflow-y-auto px-1">
          {visible.map(student => {
            const checked = student.studentId === selectedId;
            return (
              <button
                key={student.studentId}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSelectedId(student.studentId)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  checked ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                )}
              >
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  {initialsOf(student.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{student.name}</span>
                  {student.code && <span className="text-xs tabular-nums text-muted-foreground">{student.code}</span>}
                </span>
                {checked && <Check aria-hidden="true" className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p role="status" className="px-2 py-3 text-sm text-muted-foreground">
              Ningún estudiante coincide con “{query.trim()}”.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!selected || creating} onClick={() => void submit()}>
            {creating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {selected ? `Abrir PIAR de ${selected.name.split(" ")[0]}` : "Abrir PIAR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
