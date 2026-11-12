import { useState } from "react";
import { CREATOR_LIMITS, type BlockInput } from "@shared/creator";
import { parseNumberList } from "@shared/creatorFigures";
import { formatNumberEs } from "@shared/creatorMath";
import { buildHistogramClasses, fiveNumberSummary, histogramCounts, linearRegression, trendLineLatex } from "@shared/creatorStats";
import { Formula } from "../blocks/Formula";
import { BlockPreview, CaptionField, Check, Field, NumberInput, OptionalNumberInput, TextField, type Draft, type FormProps } from "./fields";
import { AddButton, RemoveButton, useListVersion } from "./FigureForms";

type StatType = "histogram" | "box_plot" | "line_chart" | "scatter_plot";

/** Contenido inicial de las figuras estadísticas al añadirlas desde «Añadir bloque». */
export const STAT_TEMPLATES: { [T in StatType]: Extract<BlockInput, { type: T }> } = {
  histogram: {
    type: "histogram",
    title: "Título del histograma",
    xLabel: "Variable",
    yLabel: "Frecuencia",
    classes: buildHistogramClasses(0, 10, [3, 7, 5, 2]),
    showValues: true,
    blank: false,
  },
  box_plot: { type: "box_plot", series: [{ data: [2, 3, 3, 4, 5, 5, 6, 7, 9] }], showValues: true, blank: false },
  line_chart: {
    type: "line_chart",
    title: "Título de la gráfica",
    categories: ["Lun", "Mar", "Mié", "Jue", "Vie"],
    series: [{ values: [4, 6, 5, 8, 7] }],
    showValues: false,
    blank: false,
  },
  scatter_plot: {
    type: "scatter_plot",
    xLabel: "Variable x",
    yLabel: "Variable y",
    points: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 6 },
    ],
    trendLine: false,
    showEquation: false,
    blank: false,
  },
};

const parsePoints = (text: string) =>
  text
    .split(";")
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => pair.split(",").map(part => Number(part.trim().replace("−", "-"))))
    .map(([x, y]) => ({ x: x ?? NaN, y: y ?? NaN }));

const parseLabels = (text: string) =>
  text
    .split(",")
    .map(label => label.trim())
    .filter(Boolean);

const DATA_HINT = "Separa los datos con comas o espacios y escribe los decimales con punto.";

/** Inicio, fin y paso de un eje; vacío significa que lo calcula el sistema. */
function AxisFields({ name, min, max, step, onChange }: { name: string; min?: number; max?: number; step?: number; onChange: (patch: { min?: number; max?: number; step?: number }) => void }) {
  return (
    <>
      <Field label={`${name}: desde`}>
        <OptionalNumberInput label={`Inicio de ${name.toLowerCase()}`} value={min} onChange={value => onChange({ min: value, max, step })} />
      </Field>
      <Field label="Hasta">
        <OptionalNumberInput label={`Fin de ${name.toLowerCase()}`} value={max} onChange={value => onChange({ min, max: value, step })} />
      </Field>
      <Field label="Paso">
        <OptionalNumberInput label={`Paso de ${name.toLowerCase()}`} value={step} onChange={value => onChange({ min, max, step: value })} />
      </Field>
    </>
  );
}

export function HistogramForm({ draft, onChange }: FormProps<"histogram">) {
  // El docente fija dónde empieza la primera clase y el ancho: así las clases salen contiguas e iguales
  const [origin, setOrigin] = useState(() => ({ start: draft.classes[0]?.from ?? 0, width: draft.classes[0] ? draft.classes[0].to - draft.classes[0].from : 10 }));
  const frequencies = draft.classes.map(item => item.frequency);
  const counted = draft.data !== undefined && draft.data.length > 0;

  const rebuild = (start: number, width: number, values: number[], data: number[] | undefined) => {
    let classes = buildHistogramClasses(start, width, values);
    const usable = data !== undefined && data.length > 0;
    // Con datos crudos, las frecuencias se cuentan: no se escriben a mano
    if (usable && data.every(Number.isFinite) && width > 0) {
      const { counts } = histogramCounts(data, classes);
      classes = classes.map((item, index) => ({ ...item, frequency: counts[index] }));
    }
    onChange({ ...draft, classes, data: usable ? data : undefined });
  };
  const setStart = (start: number) => {
    setOrigin(current => ({ ...current, start }));
    rebuild(start, origin.width, frequencies, draft.data);
  };
  const setWidth = (width: number) => {
    setOrigin(current => ({ ...current, width }));
    rebuild(origin.start, width, frequencies, draft.data);
  };
  const outside = counted && draft.data ? histogramCounts(draft.data.filter(Number.isFinite), draft.classes).outside.length : 0;

  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <TextField label="Eje horizontal" value={draft.xLabel} onChange={xLabel => onChange({ ...draft, xLabel })} />
        <TextField label="Eje vertical" value={draft.yLabel} onChange={yLabel => onChange({ ...draft, yLabel })} />
      </div>
      <div className="crt-form__row">
        <Field label="La primera clase empieza en">
          <NumberInput label="Límite inferior de la primera clase" value={origin.start} onChange={setStart} />
        </Field>
        <Field label="Ancho de cada clase">
          <NumberInput label="Ancho de cada clase" value={origin.width} onChange={setWidth} />
        </Field>
        <Field label="Tope del eje">
          <OptionalNumberInput label="Tope del eje vertical" value={draft.yMax} onChange={yMax => onChange({ ...draft, yMax })} />
        </Field>
        <Field label="Paso del eje">
          <OptionalNumberInput label="Paso del eje vertical" value={draft.yStep} onChange={yStep => onChange({ ...draft, yStep })} />
        </Field>
      </div>

      <span className="crt-form__legend">Frecuencia de cada clase</span>
      <div className="crt-form__row">
        {draft.classes.map((item, index) => {
          const closing = index === draft.classes.length - 1 ? "]" : ")";
          const name = `[${formatNumberEs(item.from, 3)}; ${formatNumberEs(item.to, 3)}${closing}`;
          return (
            <Field key={`${counted ? "c" : "m"}${index}`} label={name}>
              {counted ? (
                <input className="crt-input crt-input--num" aria-label={`Frecuencia de la clase ${name}, contada de los datos`} readOnly value={item.frequency} />
              ) : (
                <NumberInput label={`Frecuencia de la clase ${name}`} value={item.frequency} onChange={value => rebuild(origin.start, origin.width, frequencies.map((current, i) => (i === index ? value : current)), undefined)} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="crt-form__row">
        {draft.classes.length < CREATOR_LIMITS.histogramClassesMax && <AddButton onClick={() => rebuild(origin.start, origin.width, [...frequencies, 0], draft.data)}>Añadir clase</AddButton>}
        <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" disabled={draft.classes.length <= 2} onClick={() => rebuild(origin.start, origin.width, frequencies.slice(0, -1), draft.data)}>
          Quitar la última clase
        </button>
        <Check label="Frecuencia sobre cada barra" checked={draft.showValues} onChange={showValues => onChange({ ...draft, showValues })} />
        <Check label="Sin barras (las traza el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>

      <div className="crt-form__row">
        <Field label="Datos crudos (opcional): las frecuencias se cuentan solas" wide>
          <input className="crt-input" spellCheck={false} placeholder="152, 147.5, 160, 158…" defaultValue={draft.data?.join(", ") ?? ""} onChange={event => rebuild(origin.start, origin.width, frequencies, parseNumberList(event.target.value))} />
        </Field>
      </div>
      <p className="crt-form__hint">
        Cada clase incluye su límite inferior y no el superior; la última incluye los dos.
        {counted ? ` ${DATA_HINT}` : ""}
        {outside > 0 ? ` ${outside === 1 ? "Un dato queda" : `${outside} datos quedan`} fuera de las clases.` : ""}
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

function summaryText(data: number[]): string {
  const summary = data.every(Number.isFinite) && data.length >= 5 ? fiveNumberSummary(data) : null;
  if (!summary) return "Escribe al menos cinco datos.";
  return `${data.length} datos · mínimo ${formatNumberEs(summary.min)} · Q1 ${formatNumberEs(summary.q1)} · mediana ${formatNumberEs(summary.median)} · Q3 ${formatNumberEs(summary.q3)} · máximo ${formatNumberEs(summary.max)}`;
}

export function BoxPlotForm({ draft, onChange }: FormProps<"box_plot">) {
  const [version, bump] = useListVersion();
  type Series = Draft<"box_plot">["series"][number];
  const setSeries = (index: number, patch: Partial<Series>) => onChange({ ...draft, series: draft.series.map((current, i) => (i === index ? { ...current, ...patch } : current)) });

  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <TextField label="Nombre de la variable" value={draft.xLabel} onChange={xLabel => onChange({ ...draft, xLabel })} />
      </div>
      <div className="crt-form__row">
        <AxisFields name="Eje" min={draft.xMin} max={draft.xMax} step={draft.xStep} onChange={axis => onChange({ ...draft, xMin: axis.min, xMax: axis.max, xStep: axis.step })} />
        <Check label="Escribir los cinco valores" checked={draft.showValues} onChange={showValues => onChange({ ...draft, showValues })} />
        <Check label="Solo el eje (lo construye el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>

      {draft.series.map((series, index) => (
        <div key={`${version}-${index}`} className="crt-form__group">
          <div className="crt-form__row">
            <TextField label={draft.series.length > 1 ? `Grupo ${index + 1}` : "Nombre del grupo (opcional)"} value={series.label} onChange={label => setSeries(index, { label })} />
            <Field label="Datos" wide>
              <input className="crt-input" spellCheck={false} aria-label={`Datos del grupo ${index + 1}`} defaultValue={series.data.join(", ")} onChange={event => setSeries(index, { data: parseNumberList(event.target.value) })} />
            </Field>
            {draft.series.length > 1 && (
              <RemoveButton
                label={`Quitar el grupo ${index + 1}`}
                onClick={() => {
                  onChange({ ...draft, series: draft.series.filter((_, i) => i !== index) });
                  bump();
                }}
              />
            )}
          </div>
          <p className="crt-form__hint">{summaryText(series.data)}</p>
        </div>
      ))}
      {draft.series.length < 3 && <AddButton onClick={() => onChange({ ...draft, series: [...draft.series, { label: `Grupo ${draft.series.length + 1}`, data: [1, 2, 3, 4, 5] }] })}>Añadir grupo</AddButton>}
      <p className="crt-form__hint">El resumen se calcula solo. Los cuartiles son la mediana de cada mitad de los datos ordenados; si el número de datos es impar, la mediana central no entra en ninguna mitad. {DATA_HINT}</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function LineChartForm({ draft, onChange }: FormProps<"line_chart">) {
  const [version, bump] = useListVersion();
  type Series = Draft<"line_chart">["series"][number];
  const setSeries = (index: number, patch: Partial<Series>) => onChange({ ...draft, series: draft.series.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  const count = draft.categories.length;

  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <TextField label="Eje horizontal" value={draft.xLabel} onChange={xLabel => onChange({ ...draft, xLabel })} />
        <TextField label="Eje vertical" value={draft.yLabel} onChange={yLabel => onChange({ ...draft, yLabel })} />
      </div>
      <div className="crt-form__row">
        <AxisFields name="Eje vertical" min={draft.yMin} max={draft.yMax} step={draft.yStep} onChange={axis => onChange({ ...draft, yMin: axis.min, yMax: axis.max, yStep: axis.step })} />
        <Check label="Valor junto a cada punto" checked={draft.showValues} onChange={showValues => onChange({ ...draft, showValues })} />
        <Check label="Sin líneas (las traza el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>
      <div className="crt-form__row">
        <Field label="Rótulos del eje horizontal, separados por comas" wide>
          <input className="crt-input" defaultValue={draft.categories.join(", ")} onChange={event => onChange({ ...draft, categories: parseLabels(event.target.value) })} />
        </Field>
      </div>

      <span className="crt-form__legend">Series (un valor por rótulo)</span>
      {draft.series.map((series, index) => (
        <div key={`${version}-${index}`} className="crt-form__row">
          <TextField label={draft.series.length > 1 ? `Serie ${index + 1}` : "Nombre (opcional)"} value={series.label} onChange={label => setSeries(index, { label })} />
          <Field label={series.values.length === count ? `Valores (${count})` : `Valores: hay ${series.values.length} y son ${count} rótulos`} wide>
            <input className="crt-input" spellCheck={false} aria-label={`Valores de la serie ${index + 1}`} defaultValue={series.values.join(", ")} onChange={event => setSeries(index, { values: parseNumberList(event.target.value) })} />
          </Field>
          {draft.series.length > 1 && (
            <RemoveButton
              label={`Quitar la serie ${index + 1}`}
              onClick={() => {
                onChange({ ...draft, series: draft.series.filter((_, i) => i !== index) });
                bump();
              }}
            />
          )}
        </div>
      ))}
      {draft.series.length < 4 && (
        <AddButton onClick={() => onChange({ ...draft, series: [...draft.series, { label: `Serie ${draft.series.length + 1}`, values: draft.categories.map((_, i) => i + 1) }] })}>Añadir serie</AddButton>
      )}
      <p className="crt-form__hint">Los rótulos quedan a la misma distancia uno de otro. Para pares de números (x, y) usa el diagrama de dispersión. {DATA_HINT}</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function ScatterPlotForm({ draft, onChange }: FormProps<"scatter_plot">) {
  const valid = draft.points.length >= 2 && draft.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  const line = valid ? linearRegression(draft.points) : null;

  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <TextField label="Eje horizontal" value={draft.xLabel} onChange={xLabel => onChange({ ...draft, xLabel })} />
        <TextField label="Eje vertical" value={draft.yLabel} onChange={yLabel => onChange({ ...draft, yLabel })} />
      </div>
      <div className="crt-form__row">
        <Field label={`Puntos (x, y; x, y; …): ${draft.points.length}`} wide>
          <input className="crt-input crt-input--code" spellCheck={false} defaultValue={draft.points.map(point => `${point.x}, ${point.y}`).join("; ")} onChange={event => onChange({ ...draft, points: parsePoints(event.target.value) })} />
        </Field>
      </div>
      <div className="crt-form__row crt-form__row--ranges">
        <AxisFields name="Eje x" min={draft.xMin} max={draft.xMax} step={draft.xStep} onChange={axis => onChange({ ...draft, xMin: axis.min, xMax: axis.max, xStep: axis.step })} />
        <AxisFields name="Eje y" min={draft.yMin} max={draft.yMax} step={draft.yStep} onChange={axis => onChange({ ...draft, yMin: axis.min, yMax: axis.max, yStep: axis.step })} />
      </div>
      <div className="crt-form__row">
        <Check label="Recta de tendencia" checked={draft.trendLine} onChange={trendLine => onChange({ ...draft, trendLine })} />
        {draft.trendLine && <Check label="Escribir su ecuación" checked={draft.showEquation} onChange={showEquation => onChange({ ...draft, showEquation })} />}
        <Check label="Sin puntos (los ubica el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>
      <p className="crt-form__hint">
        {line ? (
          <>
            Recta de mejor ajuste, calculada por mínimos cuadrados: <Formula latex={trendLineLatex(line)} /> · correlación r = {formatNumberEs(line.r)}.
          </>
        ) : (
          "La recta de tendencia se calcula sola a partir de los puntos; necesita al menos dos con distinta x."
        )}{" "}
        Los decimales van con punto: 1.5, 3; 2, 4.2.
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}
