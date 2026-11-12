import { useMemo, useRef, useState, type DragEvent } from "react";
import { BookOpen, Download, FileSpreadsheet, GraduationCap, Loader2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AdminDialog, Pill, Segment, type Tone } from "../parts";
import {
  buildErrorReportCsv,
  buildTemplateCsv,
  decodeImportFile,
  downloadText,
  IMPORT_KIND_META,
  IMPORT_MAX_ROWS,
  parseImportText,
  type ImportKind,
  type ParsedImport,
} from "./importer";

type Step = "source" | "review" | "done";
type SourceMode = "file" | "paste";
type RowFilter = "all" | "issues" | "ok";

interface ImportUsersDialogProps {
  open: boolean;
  onClose: () => void;
  /** Al terminar, abre el directorio filtrado por el tipo cargado. */
  onViewDirectory: (kind: ImportKind) => void;
  initialKind?: ImportKind;
}

const KIND_ICONS: Record<ImportKind, typeof Users> = {
  STUDENT: GraduationCap,
  TEACHER: BookOpen,
  GUARDIAN: Users,
};

const STATUS_PILL: Record<string, { label: string; tone: Tone }> = {
  ready: { label: "Se creará", tone: "blue" },
  created: { label: "Creado", tone: "green" },
  exists: { label: "Ya existe", tone: "neutral" },
  error: { label: "Error", tone: "rose" },
};

const RELATIONSHIP_LABEL = { PARENT: "Padre / madre", LEGAL_GUARDIAN: "Tutor legal", OTHER: "Otro" } as const;

type ServerResult = {
  summary: { total: number; ready: number; created: number; exists: number; errors: number };
  rows: Array<{ index: number; name: string; email: string; status: string; message?: string; courseName?: string }>;
};

export function ImportUsersDialog({ open, onClose, onViewDirectory, initialKind = "STUDENT" }: ImportUsersDialogProps) {
  const utils = trpc.useUtils();
  const importMutation = trpc.identity.importUsers.useMutation();
  const [step, setStep] = useState<Step>("source");
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [mode, setMode] = useState<SourceMode>("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<ServerResult | null>(null);
  const [result, setResult] = useState<ServerResult | null>(null);
  const [filter, setFilter] = useState<RowFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed: ParsedImport | null = useMemo(() => (text.trim() ? parseImportText(text, kind) : null), [text, kind]);
  const meta = IMPORT_KIND_META[kind];
  const busy = importMutation.isPending;
  const blocking = parsed?.error ?? (parsed?.missingColumns.length ? `Faltan columnas: ${parsed.missingColumns.join(" y ")}.` : null);

  const reset = () => {
    setStep("source");
    setFileName(null);
    setText("");
    setPreview(null);
    setResult(null);
    setFilter("all");
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const readFile = async (file: File) => {
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      toast.error("Usa un archivo .csv (en Excel: Guardar como → CSV UTF-8).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo supera 2 MB. Divide la carga en varios archivos.");
      return;
    }
    setFileName(file.name);
    setText(decodeImportFile(await file.arrayBuffer()));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const submit = async (dryRun: boolean) => {
    if (!parsed || blocking || !parsed.rows.length) return;
    try {
      const response = await importMutation.mutateAsync({ role: "admin", kind, dryRun, rows: parsed.rows.map(item => item.row) });
      if (dryRun) {
        setPreview(response);
        setFilter(response.summary.errors ? "issues" : "all");
        setStep("review");
      } else {
        setResult(response);
        setStep("done");
        await Promise.all([utils.identity.invalidate(), utils.academic.snapshot.invalidate(), utils.educore.snapshot.invalidate()]);
        if (response.summary.created) toast.success(`${response.summary.created} ${response.summary.created === 1 ? "usuario creado" : "usuarios creados"}.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos procesar la carga.");
    }
  };

  const current = step === "done" ? result : preview;
  const lineOf = (index: number) => parsed?.rows[index]?.line ?? index + 2;
  const rowDetail = (index: number) => {
    const row = parsed?.rows[index]?.row;
    if (!row) return "—";
    if (kind === "STUDENT") return row.course ?? "Sin curso";
    if (kind === "TEACHER") return row.specialty ?? "—";
    return row.studentEmail ? `${row.studentEmail}${row.relationship ? ` · ${RELATIONSHIP_LABEL[row.relationship]}` : ""}` : "Sin estudiante";
  };
  const visibleRows = (current?.rows ?? []).filter(row =>
    filter === "issues" ? row.status === "error" || row.status === "exists" : filter === "ok" ? row.status === "ready" || row.status === "created" : true,
  );

  const downloadErrors = () => {
    const rows = (current?.rows ?? [])
      .filter(row => row.status === "error" || row.status === "exists")
      .map(row => ({ line: lineOf(row.index), name: row.name, email: row.email, message: row.message ?? "" }));
    downloadText(`errores-carga-${meta.plural.toLowerCase()}.csv`, buildErrorReportCsv(rows));
  };

  const stepIndex = step === "source" ? 0 : step === "review" ? 1 : 2;

  return (
    <AdminDialog
      open={open}
      onClose={close}
      busy={busy}
      wide
      eyebrow="Carga masiva"
      title="Cargar usuarios"
      description="Sube un CSV de Excel o pega las filas de tu hoja de cálculo. Revisas antes de guardar."
    >
      <ol className="adm-steps" aria-label="Pasos">
        {["Archivo", "Revisión", "Resultado"].map((label, index) => (
          <li key={label} style={{ display: "contents" }}>
            {index > 0 ? <span className="adm-steps__line" aria-hidden="true" /> : null}
            <span className={cn("adm-steps__item", index === stepIndex && "is-active", index < stepIndex && "is-done")} aria-current={index === stepIndex ? "step" : undefined}>
              <span className="adm-steps__num">{index + 1}</span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === "source" ? (
        <>
          <div className="adm-options" role="radiogroup" aria-label="Tipo de usuarios">
            {(Object.keys(IMPORT_KIND_META) as ImportKind[]).map(option => {
              const Icon = KIND_ICONS[option];
              const optionMeta = IMPORT_KIND_META[option];
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={kind === option}
                  className={cn("adm-option", kind === option && "is-active")}
                  onClick={() => setKind(option)}
                >
                  <span className="adm-option__icon"><Icon aria-hidden="true" strokeWidth={1.9} /></span>
                  <span className="adm-option__title">{optionMeta.plural}</span>
                  <span className="adm-option__text">{optionMeta.description}</span>
                </button>
              );
            })}
          </div>

          <div className="adm-block">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <p className="adm-block__title">Columnas de la plantilla</p>
                <p className="adm-block__text">Las marcadas con * son obligatorias. Los encabezados pueden ir con o sin tildes.</p>
              </div>
              <button
                type="button"
                className="adm-btn adm-btn--outline adm-btn--sm"
                onClick={() => downloadText(`plantilla-${meta.plural.toLowerCase()}.csv`, buildTemplateCsv(kind))}
              >
                <Download aria-hidden="true" strokeWidth={2} />
                Descargar plantilla
              </button>
            </div>
            <ul className="adm-chips">
              {meta.columns.map(column => (
                <li key={column.key} className="adm-chip adm-chip--plain">
                  {column.header}
                  {column.required ? " *" : ""}
                </li>
              ))}
            </ul>
          </div>

          <Segment
            label="Origen de los datos"
            value={mode}
            onChange={setMode}
            options={[
              { value: "file", label: "Subir archivo" },
              { value: "paste", label: "Pegar desde Excel" },
            ]}
          />

          {mode === "file" ? (
            <div
              className={cn("adm-drop", over && "is-over")}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={event => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <span className="adm-drop__icon">
                {fileName ? <FileSpreadsheet aria-hidden="true" strokeWidth={1.9} /> : <Upload aria-hidden="true" strokeWidth={1.9} />}
              </span>
              <span className="adm-drop__title">{fileName ?? "Arrastra tu archivo CSV o haz clic para elegirlo"}</span>
              <span className="adm-drop__text">
                {fileName && parsed && !parsed.error ? `${parsed.rows.length} filas detectadas` : "En Excel: Archivo → Guardar como → CSV UTF-8 · máximo " + IMPORT_MAX_ROWS + " filas"}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.tsv,text/csv"
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          ) : (
            <label className="adm-field">
              <span className="adm-label">
                Filas copiadas
                <span className="adm-label__hint">incluye la fila de encabezados</span>
              </span>
              <textarea
                className="adm-textarea"
                rows={7}
                value={text}
                onChange={event => {
                  setFileName(null);
                  setText(event.target.value);
                }}
                placeholder={`${meta.columns.map(column => column.header).join("\t")}\n${meta.examples[0].join("\t")}`}
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5 }}
              />
            </label>
          )}

          {parsed ? (
            blocking ? (
              <p className="adm-note adm-note--error" role="alert">{blocking}</p>
            ) : (
              <p className="adm-note">
                {parsed.rows.length} {parsed.rows.length === 1 ? "fila lista" : "filas listas"} para validar
                {parsed.ignoredColumns.length ? ` · se ignorarán las columnas: ${parsed.ignoredColumns.join(", ")}` : ""}
                {parsed.tooMany ? ` · solo se tomarán las primeras ${IMPORT_MAX_ROWS}` : ""}.
              </p>
            )
          ) : null}

          <div className="adm-dialog__actions">
            <button type="button" className="adm-btn adm-btn--outline" onClick={close} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              disabled={!parsed || Boolean(blocking) || !parsed.rows.length || busy}
              onClick={() => void submit(true)}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Validar {parsed && !blocking ? parsed.rows.length : ""} filas
            </button>
          </div>
        </>
      ) : null}

      {step !== "source" && current ? (
        <>
          <div className="adm-stats">
            {step === "review" ? (
              <div className="adm-stat adm-stat--blue">
                <span className="adm-stat__value adm-num">{current.summary.ready}</span>
                <span className="adm-stat__label">Se crearán</span>
              </div>
            ) : (
              <div className="adm-stat adm-stat--ok">
                <span className="adm-stat__value adm-num">{current.summary.created}</span>
                <span className="adm-stat__label">Creados</span>
              </div>
            )}
            <div className="adm-stat">
              <span className="adm-stat__value adm-num">{current.summary.exists}</span>
              <span className="adm-stat__label">Ya existen</span>
            </div>
            <div className={cn("adm-stat", current.summary.errors && "adm-stat--error")}>
              <span className="adm-stat__value adm-num">{current.summary.errors}</span>
              <span className="adm-stat__label">Con errores</span>
            </div>
            <div className="adm-stat">
              <span className="adm-stat__value adm-num">{current.summary.total}</span>
              <span className="adm-stat__label">Filas leídas</span>
            </div>
          </div>

          {step === "review" ? (
            <p className={cn("adm-note", current.summary.errors ? "adm-note--warn" : "")}>
              {current.summary.ready
                ? `Se crearán ${current.summary.ready} ${current.summary.ready === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()}${kind === "STUDENT" ? " y quedarán matriculados en el curso indicado" : kind === "GUARDIAN" ? " vinculados a su estudiante" : ""}. `
                : "No hay filas nuevas para crear. "}
              {current.summary.errors || current.summary.exists ? "Las filas con error o ya existentes se omiten." : ""}
            </p>
          ) : (
            <p className={cn("adm-note", current.summary.created ? "adm-note--ok" : "adm-note--warn")}>
              {current.summary.created
                ? `Listo: ${current.summary.created} ${current.summary.created === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()} en la plataforma.${kind === "STUDENT" ? " Ya aparecen en asistencia y en las planillas de sus docentes." : ""}`
                : "No se creó ningún usuario."}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Segment
              label="Filtrar filas"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todas", count: current.rows.length },
                { value: "ok", label: step === "review" ? "Listas" : "Creadas", count: current.summary.ready + current.summary.created },
                { value: "issues", label: "Por revisar", count: current.summary.errors + current.summary.exists },
              ]}
            />
            {current.summary.errors + current.summary.exists > 0 ? (
              <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={downloadErrors}>
                <Download aria-hidden="true" strokeWidth={2} />
                Descargar filas por revisar
              </button>
            ) : null}
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Fila</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">{kind === "STUDENT" ? "Curso" : kind === "TEACHER" ? "Especialidad" : "Estudiante"}</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const pill = STATUS_PILL[row.status] ?? STATUS_PILL.error;
                  return (
                    <tr key={row.index}>
                      <td className="adm-table__muted adm-num">{lineOf(row.index)}</td>
                      <td>{row.name || "—"}</td>
                      <td className="adm-table__muted">{row.email || "—"}</td>
                      <td className="adm-table__muted">{rowDetail(row.index)}</td>
                      <td>
                        <Pill tone={pill.tone} dot>{pill.label}</Pill>
                        {row.message ? <span className="adm-table__msg">{row.message}</span> : null}
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="adm-table__muted" style={{ textAlign: "center", padding: 18 }}>
                      No hay filas en este filtro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {step === "review" ? (
            <div className="adm-dialog__actions adm-dialog__actions--split">
              <button type="button" className="adm-btn adm-btn--outline" onClick={() => setStep("source")} disabled={busy}>
                Volver
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                disabled={!current.summary.ready || busy}
                onClick={() => void submit(false)}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" strokeWidth={2} />}
                Importar {current.summary.ready} {current.summary.ready === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()}
              </button>
            </div>
          ) : (
            <div className="adm-dialog__actions adm-dialog__actions--split">
              <button type="button" className="adm-btn adm-btn--outline" onClick={reset}>
                Cargar otro archivo
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--primary"
                onClick={() => {
                  const loaded = kind;
                  reset();
                  onClose();
                  onViewDirectory(loaded);
                }}
              >
                Ver en el directorio
              </button>
            </div>
          )}
        </>
      ) : null}
    </AdminDialog>
  );
}
