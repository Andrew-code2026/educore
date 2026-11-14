import { useState, type ReactNode } from "react";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { blockInputSchema, CREATOR_LIMITS, type BlockInput, type BlockType } from "@shared/creator";
import { parseNumberList } from "@shared/creatorFigures";
import { normalizeBlock } from "@shared/creatorOps";
import { validateBlock, valueTableVariable } from "@shared/creatorValidate";
import { AREA_MODEL_TEMPLATE, AreaModelForm } from "./AreaModelForm";
import { AngleForm, BarModelForm, BaseTenForm, CLASSROOM_TEMPLATES, ClockForm, PictogramForm, TreeDiagramForm, VennForm } from "./ClassroomForms";
import { Field, NumberInput, type Draft, type FormProps } from "./fields";
import { BalanceForm, BarChartForm, FractionModelForm, NumberLineForm, PieChartForm, ShapesForm } from "./FigureForms";
import { FormulaInput } from "./FormulaInput";
import { GraphForm } from "./GraphForm";
import { notesIssue } from "./noteDraft";
import { RichTextEditor } from "./RichTextEditor";
import { SOLID_TEMPLATE, SolidForm } from "./SolidForm";
import { BoxPlotForm, HistogramForm, LineChartForm, ScatterPlotForm, STAT_TEMPLATES } from "./StatForms";
import { TRIANGLE_TEMPLATE, TriangleForm } from "./TriangleForm";
import { UNIT_CIRCLE_TEMPLATE, UnitCircleForm } from "./UnitCircleForm";

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
  area_model: AREA_MODEL_TEMPLATE,
  shapes: { type: "shapes", figures: [{ kind: "rectangle", width: 5, height: 3, widthLabel: "5 cm", heightLabel: "3 cm" }], toScale: true },
  triangle: TRIANGLE_TEMPLATE,
  unit_circle: UNIT_CIRCLE_TEMPLATE,
  solid: SOLID_TEMPLATE,
  balance: { type: "balance", variable: "x", left: { variables: 2, units: 1, weights: [] }, right: { variables: 0, units: 7, weights: [] } },
  solution: { type: "solution", label: "Ejercicio", steps: ["Escribe aquí el primer paso."] },
  header_fields: { type: "header_fields", fields: ["Nombre", "Fecha", "Grado"] },
  page_break: { type: "page_break" },
  // Un contenedor nuevo trae algo en cada celda: así se ve de una vez cómo queda la fila
  columns: {
    type: "columns",
    columns: [
      { width: 1, blocks: [{ type: "paragraph", md: "Texto de la columna izquierda." }] },
      { width: 1, blocks: [{ type: "paragraph", md: "Texto de la columna derecha." }] },
    ],
  },
  cards: {
    type: "cards",
    perRow: 2,
    cards: [
      { title: "Tarjeta 1", blocks: [{ type: "paragraph", md: "Escribe aquí el contenido." }] },
      { title: "Tarjeta 2", blocks: [{ type: "paragraph", md: "Escribe aquí el contenido." }] },
    ],
  },
};

function ParagraphForm({ draft, onChange }: FormProps<"paragraph">) {
  return <RichTextEditor label="Texto" value={draft.md} autoFocus onChange={md => onChange({ ...draft, md })} />;
}

const HEADING_LEVEL_OPTIONS: readonly SelectOption<Draft<"heading">["level"]>[] = [
  { value: 2, label: "Grande" },
  { value: 3, label: "Mediano" },
];

export const CALLOUT_TONE_OPTIONS: readonly SelectOption<Draft<"callout">["tone"]>[] = [
  { value: "info", label: "Concepto" },
  { value: "tip", label: "Consejo" },
  { value: "warning", label: "Atención" },
];

export const ANSWER_SPACE_OPTIONS: readonly SelectOption<Draft<"exercise">["answerSpace"]>[] = [
  { value: "lines", label: "Renglones" },
  { value: "grid", label: "Cuadrícula" },
  { value: "blank", label: "En blanco" },
  { value: "none", label: "Ninguno" },
];

function HeadingForm({ draft, onChange }: FormProps<"heading">) {
  return (
    <div className="crt-form__row">
      <Field label="Título" wide>
        <input className="crt-input" autoFocus value={draft.text} onChange={event => onChange({ ...draft, text: event.target.value })} />
      </Field>
      <Field label="Tamaño">
        <OptionSelect className="crt-input" value={draft.level} onValueChange={level => onChange({ ...draft, level })} options={HEADING_LEVEL_OPTIONS} />
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
          <OptionSelect className="crt-input" value={draft.tone} onValueChange={tone => onChange({ ...draft, tone })} options={CALLOUT_TONE_OPTIONS} />
        </Field>
      </div>
      <RichTextEditor label="Contenido del recuadro" value={draft.md} autoFocus onChange={md => onChange({ ...draft, md })} />
    </>
  );
}

/** Lo que un formulario puede pedirle al editor del bloque desde un campo que atiende su propio teclado. */
export interface FormActions {
  submit: () => void;
  cancel: () => void;
}

function MathForm({ draft, onChange, actions }: FormProps<"math"> & { actions: FormActions }) {
  return (
    <>
      <FormulaInput value={draft.latex} display autoFocus onChange={latex => onChange({ ...draft, latex })} onEnter={actions.submit} onEscape={actions.cancel} />
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
          <OptionSelect className="crt-input" value={draft.answerSpace} onValueChange={answerSpace => onChange({ ...draft, answerSpace })} options={ANSWER_SPACE_OPTIONS} />
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

/** El formulario de un bloque: sus campos, sin marco ni botones (los pone el panel de edición). */
export function BlockForm({ draft, onChange, actions }: { draft: BlockInput; onChange: (next: BlockInput) => void; actions: FormActions }): ReactNode {
  switch (draft.type) {
    case "paragraph":
      return <ParagraphForm draft={draft} onChange={onChange} />;
    case "heading":
      return <HeadingForm draft={draft} onChange={onChange} />;
    case "callout":
      return <CalloutForm draft={draft} onChange={onChange} />;
    case "math":
      return <MathForm draft={draft} onChange={onChange} actions={actions} />;
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
    case "area_model":
      return <AreaModelForm draft={draft} onChange={onChange} />;
    case "shapes":
      return <ShapesForm draft={draft} onChange={onChange} />;
    case "triangle":
      return <TriangleForm draft={draft} onChange={onChange} />;
    case "unit_circle":
      return <UnitCircleForm draft={draft} onChange={onChange} />;
    case "solid":
      return <SolidForm draft={draft} onChange={onChange} />;
    case "balance":
      return <BalanceForm draft={draft} onChange={onChange} />;
    case "solution":
      return <SolutionForm draft={draft} onChange={onChange} />;
    case "page_break":
      return <p className="crt-form__hint">Lo que sigue a este bloque empieza en una página nueva al imprimir.</p>;
  }
}

export type DraftCheck = { ok: true; block: BlockInput } | { ok: false; issues: string[] };

/** Lo que se guardaría de un borrador: pasa las mismas validaciones que la IA, o dice qué corregir. */
export function checkDraft(draft: BlockInput): DraftCheck {
  // Una nota vacía se dice en palabras del docente, no con el aviso del esquema
  const emptyNote = notesIssue(draft);
  if (emptyNote) return { ok: false, issues: [emptyNote] };
  const parsed = blockInputSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, issues: z.prettifyError(parsed.error).split("\n").filter(Boolean).slice(0, 6) };
  const normalized = normalizeBlock(parsed.data);
  const problems = validateBlock(normalized);
  if (problems.length > 0) return { ok: false, issues: problems.slice(0, 6) };
  return { ok: true, block: normalized };
}
