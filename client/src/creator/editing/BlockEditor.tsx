import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { BLOCK_TYPE_LABELS, blockInputSchema, CREATOR_LIMITS, graphSpecSchema, type Block, type BlockInput, type BlockType } from "@shared/creator";
import { parseNumberList } from "@shared/creatorFigures";
import { normalizeBlock } from "@shared/creatorOps";
import { validateBlock, valueTableVariable } from "@shared/creatorValidate";
import { CoordinatePlane } from "../blocks/CoordinatePlane";
import { Formula } from "../blocks/Formula";
import { AngleForm, BarModelForm, BaseTenForm, CLASSROOM_TEMPLATES, ClockForm, PictogramForm, TreeDiagramForm, VennForm } from "./ClassroomForms";
import { Field, NumberInput, type Draft, type FormProps } from "./fields";
import { BalanceForm, BarChartForm, FractionModelForm, NumberLineForm, PieChartForm, ShapesForm } from "./FigureForms";
import type { BlockEditorHandle } from "./InlineBlockEditor";
import { RichTextEditor } from "./RichTextEditor";
import { BoxPlotForm, HistogramForm, LineChartForm, ScatterPlotForm, STAT_TEMPLATES } from "./StatForms";

/** Contenido inicial de un bloque nuevo, listo para que el docente lo complete. */
export const BLOCK_TEMPLATES: Record<BlockType, BlockInput> = {
  paragraph: { type: "paragraph", md: "Escribe aquí el texto." },
  heading: { type: "heading", text: "Nuevo título", level: 2 },
  callout: { type: "callout", title: "Recuerda", md: "Escribe aquí la idea clave.", tone: "info" },
  math: { type: "math", latex: "y = mx + b" },
  exercise: { type: "exercise", label: "Ejercicio", md: "Escribe aquí el enunciado.", parts: [], answerSpace: "lines", lines: 4 },
  table: { type: "table", header: ["Columna 1", "Columna 2"], rows: [["", ""], ["", ""]], firstColumnHeader: false },
  value_table: { type: "value_table", expr: "2*x + 1", exprLatex: "y = 2x + 1", xs: [-2, -1, 0, 1, 2], blankY: false },
  graph: { type: "graph", spec: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [], points: [] } },
  number_line: { type: "number_line", min: 0, max: 10, step: 1, labelEvery: 1, showNumbers: true, points: [], jumps: [], intervals: [] },
  fraction_model: {
    type: "fraction_model",
    shape: "circle",
    models: [
      { numerator: 1, denominator: 2 },
      { numerator: 2, denominator: 4 },
    ],
    operator: "equals",
    showLabels: true,
  },
  bar_chart: {
    type: "bar_chart",
    title: "Título del diagrama",
    bars: [
      { label: "Categoría 1", value: 4 },
      { label: "Categoría 2", value: 7 },
      { label: "Categoría 3", value: 3 },
    ],
    showValues: true,
    blank: false,
  },
  pie_chart: {
    type: "pie_chart",
    slices: [
      { label: "Categoría 1", value: 5 },
      { label: "Categoría 2", value: 3 },
      { label: "Categoría 3", value: 2 },
    ],
    showPercent: true,
    blank: false,
  },
  ...STAT_TEMPLATES,
  ...CLASSROOM_TEMPLATES,
  shapes: { type: "shapes", figures: [{ kind: "rectangle", width: 5, height: 3, widthLabel: "5 cm", heightLabel: "3 cm" }], toScale: true },
  balance: { type: "balance", variable: "x", left: { variables: 2, units: 1, weights: [] }, right: { variables: 0, units: 7, weights: [] } },
  solution: { type: "solution", label: "Ejercicio", steps: ["Escribe aquí el primer paso."] },
  header_fields: { type: "header_fields", fields: ["Nombre", "Fecha", "Grado"] },
  page_break: { type: "page_break" },
};

/** Orden en que se ofrecen los bloques al añadir uno. */
export const ADDABLE_BLOCKS: BlockType[] = [
  "paragraph",
  "exercise",
  "callout",
  "heading",
  "math",
  "table",
  "value_table",
  "graph",
  "number_line",
  "fraction_model",
  "bar_chart",
  "pie_chart",
  "histogram",
  "box_plot",
  "line_chart",
  "scatter_plot",
  "angle",
  "venn",
  "tree_diagram",
  "bar_model",
  "pictogram",
  "clock",
  "base_ten",
  "shapes",
  "balance",
  "solution",
  "page_break",
];

function ParagraphForm({ draft, onChange }: FormProps<"paragraph">) {
  return <RichTextEditor label="Texto" value={draft.md} autoFocus onChange={md => onChange({ ...draft, md })} />;
}

function HeadingForm({ draft, onChange }: FormProps<"heading">) {
  return (
    <div className="crt-form__row">
      <Field label="Título" wide>
        <input className="crt-input" autoFocus value={draft.text} onChange={event => onChange({ ...draft, text: event.target.value })} />
      </Field>
      <Field label="Tamaño">
        <select className="crt-input" value={draft.level} onChange={event => onChange({ ...draft, level: Number(event.target.value) === 3 ? 3 : 2 })}>
          <option value={2}>Grande</option>
          <option value={3}>Mediano</option>
        </select>
      </Field>
    </div>
  );
}

function CalloutForm({ draft, onChange }: FormProps<"callout">) {
  return (
    <>
      <div className="crt-form__row">
        <Field label="Título del recuadro" wide>
          <input className="crt-input" value={draft.title ?? ""} onChange={event => onChange({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="Estilo">
          <select className="crt-input" value={draft.tone} onChange={event => onChange({ ...draft, tone: event.target.value as Draft<"callout">["tone"] })}>
            <option value="info">Concepto</option>
            <option value="tip">Consejo</option>
            <option value="warning">Atención</option>
          </select>
        </Field>
      </div>
      <RichTextEditor label="Contenido del recuadro" value={draft.md} autoFocus onChange={md => onChange({ ...draft, md })} />
    </>
  );
}

function MathForm({ draft, onChange }: FormProps<"math">) {
  return (
    <>
      <Field label="Fórmula en LaTeX" wide>
        <textarea className="crt-input crt-input--code" rows={2} autoFocus spellCheck={false} value={draft.latex} onChange={event => onChange({ ...draft, latex: event.target.value })} />
      </Field>
      <div className="crt-form__preview">{draft.latex.trim() ? <Formula latex={draft.latex} display /> : <span className="crt-muted">Vista previa</span>}</div>
    </>
  );
}

function HeaderFieldsForm({ draft, onChange }: FormProps<"header_fields">) {
  return (
    <Field label="Campos, separados por comas" wide>
      <input
        className="crt-input"
        autoFocus
        defaultValue={draft.fields.join(", ")}
        onChange={event => onChange({ ...draft, fields: event.target.value.split(",").map(field => field.trim()).filter(Boolean) })}
      />
    </Field>
  );
}

function ExerciseForm({ draft, onChange }: FormProps<"exercise">) {
  const [listVersion, setListVersion] = useState(0);
  const setPart = (index: number, patch: Partial<Draft<"exercise">["parts"][number]>) =>
    onChange({ ...draft, parts: draft.parts.map((part, i) => (i === index ? { ...part, ...patch } : part)) });

  return (
    <>
      <div className="crt-form__row">
        <Field label="Rótulo">
          <input className="crt-input" value={draft.label} onChange={event => onChange({ ...draft, label: event.target.value })} />
        </Field>
        <Field label="Espacio de respuesta">
          <select className="crt-input" value={draft.answerSpace} onChange={event => onChange({ ...draft, answerSpace: event.target.value as Draft<"exercise">["answerSpace"] })}>
            <option value="lines">Renglones</option>
            <option value="grid">Cuadrícula</option>
            <option value="blank">En blanco</option>
            <option value="none">Ninguno</option>
          </select>
        </Field>
        {draft.answerSpace !== "none" && (
          <Field label="Alto (renglones)">
            <NumberInput label="Alto del espacio de respuesta" value={draft.lines} onChange={lines => onChange({ ...draft, lines })} />
          </Field>
        )}
      </div>
      <RichTextEditor label="Enunciado" value={draft.md} autoFocus onChange={md => onChange({ ...draft, md })} />

      {draft.parts.map((part, index) => (
        <div key={`${listVersion}-${index}`} className="crt-form__item">
          <input className="crt-input crt-input--tiny" aria-label={`Letra del inciso ${index + 1}`} value={part.label} onChange={event => setPart(index, { label: event.target.value })} />
          <RichTextEditor compact label={`Inciso ${part.label}`} value={part.md} onChange={md => setPart(index, { md })} />
          <button
            type="button"
            className="crt-icon-btn crt-icon-btn--danger"
            aria-label={`Quitar el inciso ${part.label}`}
            onClick={() => {
              onChange({ ...draft, parts: draft.parts.filter((_, i) => i !== index) });
              setListVersion(version => version + 1);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      {draft.parts.length < 8 && (
        <button
          type="button"
          className="crt-btn crt-btn--ghost crt-btn--sm"
          onClick={() => onChange({ ...draft, parts: [...draft.parts, { label: String.fromCharCode(97 + draft.parts.length), md: "Escribe aquí el inciso." }] })}
        >
          <Plus aria-hidden="true" />
          Añadir inciso
        </button>
      )}
    </>
  );
}

function TableForm({ draft, onChange }: FormProps<"table">) {
  const columns = draft.header.length;
  const setCell = (row: number, column: number, value: string) =>
    onChange({ ...draft, rows: draft.rows.map((cells, r) => (r === row ? cells.map((cell, c) => (c === column ? value : cell)) : cells)) });

  return (
    <>
      <div className="crt-form__grid-wrap">
        <table className="crt-form__grid">
          <thead>
            <tr>
              {draft.header.map((cell, column) => (
                <th key={column}>
                  <input
                    className="crt-input"
                    aria-label={`Encabezado de la columna ${column + 1}`}
                    value={cell}
                    onChange={event => onChange({ ...draft, header: draft.header.map((value, c) => (c === column ? event.target.value : value)) })}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input className="crt-input" aria-label={`Fila ${r + 1}, columna ${c + 1}`} value={cell} onChange={event => setCell(r, c, event.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="crt-form__actions">
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" disabled={draft.rows.length >= CREATOR_LIMITS.tableRowsMax} onClick={() => onChange({ ...draft, rows: [...draft.rows, Array.from({ length: columns }, () => "")] })}>
          <Plus aria-hidden="true" />
          Fila
        </button>
        <button
          type="button"
          className="crt-btn crt-btn--ghost crt-btn--sm"
          disabled={columns >= CREATOR_LIMITS.tableColsMax}
          onClick={() => onChange({ ...draft, header: [...draft.header, `Columna ${columns + 1}`], rows: draft.rows.map(row => [...row, ""]) })}
        >
          <Plus aria-hidden="true" />
          Columna
        </button>
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" disabled={draft.rows.length <= 1} onClick={() => onChange({ ...draft, rows: draft.rows.slice(0, -1) })}>
          Quitar última fila
        </button>
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" disabled={columns <= 1} onClick={() => onChange({ ...draft, header: draft.header.slice(0, -1), rows: draft.rows.map(row => row.slice(0, -1)) })}>
          Quitar última columna
        </button>
      </div>
      <div className="crt-form__row">
        <Field label="Pie de tabla (opcional)" wide>
          <input className="crt-input" value={draft.caption ?? ""} onChange={event => onChange({ ...draft, caption: event.target.value || undefined })} />
        </Field>
        <label className="crt-check">
          <input type="checkbox" checked={draft.firstColumnHeader} onChange={event => onChange({ ...draft, firstColumnHeader: event.target.checked })} />
          Primera columna como encabezado
        </label>
      </div>
      <p className="crt-form__hint">Las celdas admiten fórmulas entre signos de dólar, por ejemplo $x^2$. Deja una celda vacía para que el estudiante la complete.</p>
    </>
  );
}

function ValueTableForm({ draft, onChange }: FormProps<"value_table">) {
  // Sin variable escrita se usa la del encabezado ("A(s) = …" → s), y si no, x
  const fallback = valueTableVariable({ exprLatex: draft.exprLatex });
  const shown = draft.variable ?? fallback;
  return (
    <>
      <div className="crt-form__row">
        <Field label={`Función de ${shown}`} wide>
          <input className="crt-input crt-input--code" autoFocus spellCheck={false} value={draft.expr} placeholder="x^2 - 4*x + 3" onChange={event => onChange({ ...draft, expr: event.target.value })} />
        </Field>
        <Field label="Como se muestra (LaTeX)" wide>
          <input className="crt-input crt-input--code" spellCheck={false} value={draft.exprLatex} placeholder="y = x^{2} - 4x + 3" onChange={event => onChange({ ...draft, exprLatex: event.target.value })} />
        </Field>
      </div>
      <div className="crt-form__row">
        <Field label="Variable">
          <input
            className="crt-input crt-input--tiny"
            spellCheck={false}
            maxLength={1}
            aria-label="Variable de la tabla"
            value={draft.variable ?? ""}
            placeholder={fallback}
            onChange={event => onChange({ ...draft, variable: /^[A-Za-z]$/.test(event.target.value) ? event.target.value : undefined })}
          />
        </Field>
        <Field label={`Valores de ${shown}, separados por comas`} wide>
          <input className="crt-input" defaultValue={draft.xs.join(", ")} onChange={event => onChange({ ...draft, xs: parseNumberList(event.target.value) })} />
        </Field>
        <label className="crt-check">
          <input type="checkbox" checked={draft.blankY} onChange={event => onChange({ ...draft, blankY: event.target.checked })} />
          El estudiante completa los resultados
        </label>
      </div>
      <p className="crt-form__hint">Los resultados se calculan solos a partir de la función. Puedes escribirla con {shown === "x" ? "x" : `${shown} o con x`}.</p>
    </>
  );
}

function GraphForm({ draft, onChange }: FormProps<"graph">) {
  const [listVersion, setListVersion] = useState(0);
  const spec = draft.spec;
  const setSpec = (patch: Partial<typeof spec>) => onChange({ ...draft, spec: { ...spec, ...patch } });
  const preview = graphSpecSchema.safeParse(spec);
  const bump = () => setListVersion(version => version + 1);

  return (
    <>
      <div className="crt-form__row crt-form__row--ranges">
        {(
          [
            ["xMin", "x mínimo"],
            ["xMax", "x máximo"],
            ["yMin", "y mínimo"],
            ["yMax", "y máximo"],
            ["xStep", "Paso en x"],
            ["yStep", "Paso en y"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <NumberInput label={label} value={spec[key]} onChange={value => setSpec({ [key]: value })} />
          </Field>
        ))}
      </div>

      <span className="crt-form__legend">Funciones</span>
      {spec.functions.map((fn, index) => (
        <div key={`${listVersion}-f${index}`} className="crt-form__item">
          <input
            className="crt-input crt-input--code"
            aria-label={`Función ${index + 1}`}
            spellCheck={false}
            placeholder="2*x - 3"
            value={fn.expr}
            onChange={event => setSpec({ functions: spec.functions.map((current, i) => (i === index ? { ...current, expr: event.target.value } : current)) })}
          />
          <input
            className="crt-input crt-input--code"
            aria-label={`Etiqueta de la función ${index + 1} en LaTeX`}
            spellCheck={false}
            placeholder="y = 2x - 3"
            value={fn.label ?? ""}
            onChange={event => setSpec({ functions: spec.functions.map((current, i) => (i === index ? { ...current, label: event.target.value || undefined } : current)) })}
          />
          <button
            type="button"
            className="crt-icon-btn crt-icon-btn--danger"
            aria-label={`Quitar la función ${index + 1}`}
            onClick={() => {
              // Los puntos que estaban sobre esta función quedan libres; los de las siguientes se reindexan
              const points = spec.points.map(point => (point.on == null ? point : point.on === index ? { ...point, on: null } : point.on > index ? { ...point, on: point.on - 1 } : point));
              setSpec({ functions: spec.functions.filter((_, i) => i !== index), points });
              bump();
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      {spec.functions.length < CREATOR_LIMITS.functionsMax && (
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" onClick={() => setSpec({ functions: [...spec.functions, { expr: "x" }] })}>
          <Plus aria-hidden="true" />
          Añadir función
        </button>
      )}

      <span className="crt-form__legend">Puntos marcados</span>
      {spec.points.map((point, index) => {
        const setPoint = (patch: Partial<typeof point>) => setSpec({ points: spec.points.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
        return (
          <div key={`${listVersion}-p${index}`} className="crt-form__item">
            <NumberInput label={`x del punto ${index + 1}`} value={point.x} onChange={x => setPoint({ x })} />
            <NumberInput label={`y del punto ${index + 1}`} value={point.y} onChange={y => setPoint({ y })} />
            <input className="crt-input crt-input--code" aria-label={`Etiqueta del punto ${index + 1} en LaTeX`} spellCheck={false} placeholder="(0, -3)" value={point.label ?? ""} onChange={event => setPoint({ label: event.target.value || undefined })} />
            <select className="crt-input" aria-label={`Función del punto ${index + 1}`} value={point.on ?? ""} onChange={event => setPoint({ on: event.target.value === "" ? null : Number(event.target.value) })}>
              <option value="">Punto libre</option>
              {spec.functions.map((fn, i) => (
                <option key={i} value={i}>
                  Sobre {fn.expr || `función ${i + 1}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="crt-icon-btn crt-icon-btn--danger"
              aria-label={`Quitar el punto ${index + 1}`}
              onClick={() => {
                setSpec({ points: spec.points.filter((_, i) => i !== index) });
                bump();
              }}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {spec.points.length < CREATOR_LIMITS.pointsMax && (
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" onClick={() => setSpec({ points: [...spec.points, { x: 0, y: 0, on: null }] })}>
          <Plus aria-hidden="true" />
          Añadir punto
        </button>
      )}

      <Field label="Pie de la gráfica (opcional)" wide>
        <input className="crt-input" value={draft.caption ?? ""} onChange={event => onChange({ ...draft, caption: event.target.value || undefined })} />
      </Field>
      <div className="crt-form__preview">{preview.success ? <CoordinatePlane spec={preview.data} /> : <span className="crt-muted">Completa los rangos para ver la gráfica.</span>}</div>
    </>
  );
}

function SolutionForm({ draft, onChange }: FormProps<"solution">) {
  const [listVersion, setListVersion] = useState(0);
  return (
    <>
      <Field label="Ejercicio al que responde">
        <input className="crt-input" value={draft.label} onChange={event => onChange({ ...draft, label: event.target.value })} />
      </Field>
      <span className="crt-form__legend">Procedimiento</span>
      {draft.steps.map((step, index) => (
        <div key={`${listVersion}-${index}`} className="crt-form__item">
          <span className="crt-form__index">{index + 1}</span>
          <RichTextEditor compact label={`Paso ${index + 1}`} value={step} onChange={md => onChange({ ...draft, steps: draft.steps.map((current, i) => (i === index ? md : current)) })} />
          <button
            type="button"
            className="crt-icon-btn crt-icon-btn--danger"
            aria-label={`Quitar el paso ${index + 1}`}
            onClick={() => {
              onChange({ ...draft, steps: draft.steps.filter((_, i) => i !== index) });
              setListVersion(version => version + 1);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      ))}
      {draft.steps.length < 12 && (
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" onClick={() => onChange({ ...draft, steps: [...draft.steps, "Escribe aquí el paso."] })}>
          <Plus aria-hidden="true" />
          Añadir paso
        </button>
      )}
      <span className="crt-form__legend">Respuesta final</span>
      <RichTextEditor compact label="Respuesta final" value={draft.answer ?? ""} placeholder="Opcional" onChange={md => onChange({ ...draft, answer: md || undefined })} />
    </>
  );
}

function renderForm(draft: BlockInput, onChange: (next: BlockInput) => void): ReactNode {
  switch (draft.type) {
    case "paragraph":
      return <ParagraphForm draft={draft} onChange={onChange} />;
    case "heading":
      return <HeadingForm draft={draft} onChange={onChange} />;
    case "callout":
      return <CalloutForm draft={draft} onChange={onChange} />;
    case "math":
      return <MathForm draft={draft} onChange={onChange} />;
    case "header_fields":
      return <HeaderFieldsForm draft={draft} onChange={onChange} />;
    case "exercise":
      return <ExerciseForm draft={draft} onChange={onChange} />;
    case "table":
      return <TableForm draft={draft} onChange={onChange} />;
    case "value_table":
      return <ValueTableForm draft={draft} onChange={onChange} />;
    case "graph":
      return <GraphForm draft={draft} onChange={onChange} />;
    case "number_line":
      return <NumberLineForm draft={draft} onChange={onChange} />;
    case "fraction_model":
      return <FractionModelForm draft={draft} onChange={onChange} />;
    case "bar_chart":
      return <BarChartForm draft={draft} onChange={onChange} />;
    case "pie_chart":
      return <PieChartForm draft={draft} onChange={onChange} />;
    case "histogram":
      return <HistogramForm draft={draft} onChange={onChange} />;
    case "box_plot":
      return <BoxPlotForm draft={draft} onChange={onChange} />;
    case "line_chart":
      return <LineChartForm draft={draft} onChange={onChange} />;
    case "scatter_plot":
      return <ScatterPlotForm draft={draft} onChange={onChange} />;
    case "angle":
      return <AngleForm draft={draft} onChange={onChange} />;
    case "venn":
      return <VennForm draft={draft} onChange={onChange} />;
    case "tree_diagram":
      return <TreeDiagramForm draft={draft} onChange={onChange} />;
    case "bar_model":
      return <BarModelForm draft={draft} onChange={onChange} />;
    case "pictogram":
      return <PictogramForm draft={draft} onChange={onChange} />;
    case "clock":
      return <ClockForm draft={draft} onChange={onChange} />;
    case "base_ten":
      return <BaseTenForm draft={draft} onChange={onChange} />;
    case "shapes":
      return <ShapesForm draft={draft} onChange={onChange} />;
    case "balance":
      return <BalanceForm draft={draft} onChange={onChange} />;
    case "solution":
      return <SolutionForm draft={draft} onChange={onChange} />;
    case "page_break":
      return <p className="crt-form__hint">Lo que sigue a este bloque empieza en una página nueva al imprimir.</p>;
  }
}

interface BlockEditorProps {
  block: Block;
  onSave: (next: BlockInput) => void;
  onCancel: () => void;
}

/** Formulario de edición de un bloque. No guarda nada que no pase las mismas validaciones que la IA. */
export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor({ block, onSave, onCancel }, ref) {
  const [draft, setDraft] = useState<BlockInput>(() => {
    const { id: _id, ...content } = block;
    return content as BlockInput;
  });
  const [issues, setIssues] = useState<string[]>([]);
  const form = useRef<HTMLDivElement>(null);

  const save = (): boolean => {
    const parsed = blockInputSchema.safeParse(draft);
    if (!parsed.success) {
      setIssues(z.prettifyError(parsed.error).split("\n").filter(Boolean).slice(0, 6));
      return false;
    }
    const normalized = normalizeBlock(parsed.data);
    const problems = validateBlock(normalized);
    if (problems.length > 0) {
      setIssues(problems.slice(0, 6));
      return false;
    }
    onSave(normalized);
    return true;
  };

  // La hoja puede pedir que se guarde lo que hay (antes de que la IA empiece a trabajar), siempre con el borrador al día
  const saveRef = useRef(save);
  saveRef.current = save;
  useImperativeHandle(
    ref,
    () => ({
      settle: () => saveRef.current(),
      focus: () => form.current?.querySelector<HTMLElement>("input, textarea, select, [contenteditable='true']")?.focus(),
    }),
    [],
  );

  return (
    <div
      ref={form}
      className="crt-form"
      role="group"
      aria-label={`Editar ${BLOCK_TYPE_LABELS[block.type].toLowerCase()}`}
      onKeyDown={event => {
        if (event.key === "Escape") onCancel();
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) save();
      }}
    >
      <span className="crt-form__title">{BLOCK_TYPE_LABELS[block.type]}</span>
      {renderForm(draft, next => {
        setDraft(next);
        if (issues.length > 0) setIssues([]);
      })}
      {issues.length > 0 && (
        <ul className="crt-form__issues" role="alert">
          {issues.map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>
      )}
      <div className="crt-form__footer">
        <button type="button" className="crt-btn crt-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="crt-btn crt-btn--primary" onClick={save}>
          Guardar cambios
        </button>
      </div>
    </div>
  );
});
