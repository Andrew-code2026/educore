import { OptionSelect, type SelectOption } from "@/components/option-select";
import { CREATOR_LIMITS, type BlockInput } from "@shared/creator";
import { niceStep, parseNumberList } from "@shared/creatorFigures";
import { buildFrequencyTable, contingencyTotals, distributionOf, frequencySource, joinEs, measureText, type FrequencySource, type RelativeFormat, type StatMeasureKey } from "@shared/creatorStatTables";
import { Check, Field, NumberInput, OptionalNumberInput, TextField, type Draft, type FormProps } from "./fields";
import { AddButton, RemoveButton, useListVersion } from "./FigureForms";

type TableType = "frequency_table" | "contingency_table";

/** Contenido inicial de las tablas estadísticas al añadirlas desde «Añadir bloque». */
export const STAT_TABLE_TEMPLATES: { [T in TableType]: Extract<BlockInput, { type: T }> } = {
  frequency_table: {
    type: "frequency_table",
    variable: "Número de hermanos",
    data: [0, 1, 1, 2, 2, 2, 3, 1, 0, 2, 4, 1, 2, 3, 1, 2, 0, 1, 2, 3],
    relative: ["decimal"],
    cumulative: true,
    cumulativeRelative: false,
    classMark: false,
    totals: true,
    measures: [],
    blank: [],
  },
  contingency_table: {
    type: "contingency_table",
    rowVariable: "Grado",
    columnVariable: "Cómo llega al colegio",
    columns: ["A pie", "En bus", "En bicicleta"],
    rows: [
      { label: "Sexto", counts: [12, 8, 5] },
      { label: "Séptimo", counts: [9, 11, 6] },
    ],
    display: "counts",
    totals: true,
    blank: [],
  },
};

const DATA_HINT = "Separa los datos con comas o espacios y escribe los decimales con punto.";

/* ── Tabla de frecuencias ── */

type FrequencyDraft = Draft<"frequency_table">;
type BlankKey = FrequencyDraft["blank"][number];

const SOURCE_OPTIONS: readonly SelectOption<FrequencySource>[] = [
  { value: "data", label: "Datos numéricos sueltos" },
  { value: "values", label: "Valores con su frecuencia" },
  { value: "categories", label: "Categorías con su frecuencia" },
];

const RELATIVE_OPTIONS: ReadonlyArray<{ format: RelativeFormat; label: string }> = [
  { format: "fraction", label: "Fracción" },
  { format: "decimal", label: "Decimal" },
  { format: "percent", label: "Porcentaje" },
];

const MEASURE_OPTIONS: ReadonlyArray<{ key: StatMeasureKey; label: string }> = [
  { key: "mean", label: "Media" },
  { key: "median", label: "Mediana" },
  { key: "mode", label: "Moda" },
  { key: "range", label: "Rango" },
  { key: "variance", label: "Varianza" },
  { key: "stdDev", label: "Desviación estándar" },
];

/**
 * Deja el borrador coherente después de un cambio: sin marca de clase si no hay clases, solo la moda
 * con categorías y sin columnas en blanco que ya no se muestran. Así el formulario nunca ofrece algo
 * que el validador rechazaría por una casilla que quedó marcada de antes.
 */
function tidyFrequency(draft: FrequencyDraft): FrequencyDraft {
  const classMark = draft.classMark && draft.classes !== undefined;
  const measures = draft.categories !== undefined ? draft.measures.filter(key => key === "mode") : draft.measures;
  const shown: Record<BlankKey, boolean> = {
    classMark,
    absolute: true,
    relative: draft.relative.length > 0,
    cumulative: draft.cumulative,
    cumulativeRelative: draft.cumulativeRelative,
    measures: measures.length > 0,
  };
  return { ...draft, classMark, measures, blank: draft.blank.filter(key => shown[key]) };
}

const toggle = <T,>(list: readonly T[], item: T, on: boolean): T[] => (on ? (list.includes(item) ? [...list] : [...list, item]) : list.filter(current => current !== item));

/** Las filas del borrador como valor (si es numérico), rótulo y conteo: para pasar de una forma de dar los datos a otra. */
function draftRows(draft: FrequencyDraft): Array<{ label: string; value?: number; count: number }> {
  if (draft.categories) return draft.categories.map(item => ({ label: item.label, count: item.count }));
  if (draft.values) return draft.values.map(item => ({ label: String(item.value), value: item.value, count: item.count }));
  return distributionOf((draft.data ?? []).filter(Number.isFinite)).map(item => ({ label: String(item.value), value: item.value, count: item.count }));
}

/** Pasa los datos a otra forma conservando lo que se pueda: datos ↔ valores contados, y cualquiera a categorías. */
function switchSource(draft: FrequencyDraft, next: FrequencySource): FrequencyDraft {
  const rows = draftRows(draft);
  const base: FrequencyDraft = { ...draft, data: undefined, values: undefined, categories: undefined, classes: undefined };
  const numeric = rows.length > 0 && rows.every(row => row.value !== undefined && Number.isFinite(row.value));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (next === "data") {
    const data = numeric && total > 0 && total <= CREATOR_LIMITS.statDataMax ? rows.flatMap(row => Array.from({ length: row.count }, () => row.value!)) : STAT_TABLE_TEMPLATES.frequency_table.data!;
    return tidyFrequency({ ...base, data });
  }
  if (next === "values") {
    const usable = numeric && rows.length >= 2 && rows.length <= CREATOR_LIMITS.statTableRowsMax;
    return tidyFrequency({ ...base, values: usable ? rows.map(row => ({ value: row.value!, count: row.count })) : [0, 1, 2, 3].map((value, index) => ({ value, count: [3, 6, 4, 2][index] })) });
  }
  const usable = rows.length >= 2 && rows.length <= CREATOR_LIMITS.statTableRowsMax;
  return tidyFrequency({
    ...base,
    categories: usable
      ? rows.map(row => ({ label: row.label, count: row.count }))
      : [
          { label: "Fútbol", count: 12 },
          { label: "Baloncesto", count: 7 },
          { label: "Natación", count: 5 },
        ],
  });
}

/** Clases iniciales al agrupar: unas cinco, de ancho redondo, que empiezan en un múltiplo del ancho. */
function suggestClasses(data: readonly number[]): NonNullable<FrequencyDraft["classes"]> {
  const finite = data.filter(Number.isFinite);
  if (finite.length === 0) return { start: 0, width: 10 };
  const lowest = Math.min(...finite);
  const width = niceStep(Math.max(...finite) - lowest || 1, 5);
  return { start: Number((Math.floor(lowest / width) * width).toPrecision(12)), width };
}

/** Lo que el docente ve calculado bajo los datos, o qué falta para que la tabla se arme. */
function frequencySummary(draft: FrequencyDraft): string {
  const finite = draft.data ? draft.data.every(Number.isFinite) : true;
  if (!finite) return "Hay un dato que no es un número.";
  const built = buildFrequencyTable(draft);
  if (!built.ok) return `${built.issues[0][0].toUpperCase()}${built.issues[0].slice(1)}`;
  const { model } = built;
  const rows = `${model.total} datos en ${model.rows.length} ${model.grouped ? "clases" : "filas"}`;
  const modes = model.modeRows.map(index => model.rows[index].label);
  const mode = modes.length === 0 ? "sin moda" : `${model.grouped ? (modes.length > 1 ? "clases modales" : "clase modal") : modes.length > 1 ? "modas" : "moda"} ${joinEs(modes)}`;
  if (!model.measures) return `${rows} · ${mode}.`;
  const m = model.measures;
  return `${rows} · media ${measureText(m.mean)} · mediana ${measureText(m.median)} · ${mode} · rango ${measureText(m.range)} · desviación estándar ${measureText(m.stdDev)}.`;
}

function ValueRows({ rows, onChange }: { rows: Array<{ value: number; count: number }>; onChange: (rows: Array<{ value: number; count: number }>) => void }) {
  const [version, bump] = useListVersion();
  return (
    <>
      {rows.map((row, index) => (
        <div key={`${version}-${index}`} className="crt-form__item">
          <NumberInput label={`Valor de la fila ${index + 1}`} value={row.value} onChange={value => onChange(rows.map((r, i) => (i === index ? { ...r, value } : r)))} />
          <NumberInput label={`Frecuencia de la fila ${index + 1}`} value={row.count} onChange={count => onChange(rows.map((r, i) => (i === index ? { ...r, count } : r)))} />
          {rows.length > 2 && (
            <RemoveButton
              label={`Quitar la fila ${index + 1}`}
              onClick={() => {
                onChange(rows.filter((_, i) => i !== index));
                bump();
              }}
            />
          )}
        </div>
      ))}
      {rows.length < CREATOR_LIMITS.statTableRowsMax && <AddButton onClick={() => onChange([...rows, { value: (rows[rows.length - 1]?.value ?? 0) + 1, count: 1 }])}>Añadir valor</AddButton>}
    </>
  );
}

function CategoryRows({ rows, onChange }: { rows: Array<{ label: string; count: number }>; onChange: (rows: Array<{ label: string; count: number }>) => void }) {
  const [version, bump] = useListVersion();
  return (
    <>
      {rows.map((row, index) => (
        <div key={`${version}-${index}`} className="crt-form__item">
          <input className="crt-input" aria-label={`Nombre de la categoría ${index + 1}`} value={row.label} onChange={event => onChange(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))} />
          <NumberInput label={`Frecuencia de la categoría ${index + 1}`} value={row.count} onChange={count => onChange(rows.map((r, i) => (i === index ? { ...r, count } : r)))} />
          {rows.length > 2 && (
            <RemoveButton
              label={`Quitar la categoría ${index + 1}`}
              onClick={() => {
                onChange(rows.filter((_, i) => i !== index));
                bump();
              }}
            />
          )}
        </div>
      ))}
      {rows.length < CREATOR_LIMITS.statTableRowsMax && <AddButton onClick={() => onChange([...rows, { label: `Categoría ${rows.length + 1}`, count: 1 }])}>Añadir categoría</AddButton>}
    </>
  );
}

export function FrequencyTableForm({ draft, onChange }: FormProps<"frequency_table">) {
  const [version, bump] = useListVersion();
  const source = frequencySource(draft) ?? "data";
  const set = (patch: Partial<FrequencyDraft>) => onChange(tidyFrequency({ ...draft, ...patch }));
  const grouped = draft.classes !== undefined;
  const blankOptions: ReadonlyArray<{ key: BlankKey; label: string; shown: boolean }> = [
    { key: "classMark", label: "Marca de clase", shown: draft.classMark },
    { key: "absolute", label: "Absoluta", shown: true },
    { key: "relative", label: "Relativa", shown: draft.relative.length > 0 },
    { key: "cumulative", label: "Acumulada", shown: draft.cumulative },
    { key: "cumulativeRelative", label: "Relativa acumulada", shown: draft.cumulativeRelative },
    { key: "measures", label: "Medidas", shown: draft.measures.length > 0 },
  ];

  return (
    <>
      <div className="crt-form__row">
        <Field label="Variable (encabezado de la primera columna)" wide>
          <input className="crt-input" value={draft.variable} onChange={event => set({ variable: event.target.value })} />
        </Field>
        <Field label="Los datos vienen como">
          <OptionSelect
            className="crt-input"
            value={source}
            options={SOURCE_OPTIONS}
            onValueChange={next => {
              onChange(switchSource(draft, next));
              bump();
            }}
          />
        </Field>
      </div>

      {source === "data" && (
        <div key={`data-${version}`} className="crt-form__group">
          <div className="crt-form__row">
            <Field label={`Datos (${draft.data?.length ?? 0})`} wide>
              <input className="crt-input" spellCheck={false} defaultValue={draft.data?.join(", ") ?? ""} onChange={event => set({ data: parseNumberList(event.target.value) })} />
            </Field>
          </div>
          <div className="crt-form__row">
            <Check label="Agrupar en clases" checked={grouped} onChange={on => set({ classes: on ? suggestClasses(draft.data ?? []) : undefined })} />
            {draft.classes && (
              <>
                <Field label="La primera clase empieza en">
                  <NumberInput label="Límite inferior de la primera clase" value={draft.classes.start} onChange={start => set({ classes: { ...draft.classes!, start } })} />
                </Field>
                <Field label="Ancho de cada clase">
                  <NumberInput label="Ancho de cada clase" value={draft.classes.width} onChange={width => set({ classes: { ...draft.classes!, width } })} />
                </Field>
                <Field label="Número de clases">
                  <OptionalNumberInput label="Número de clases" value={draft.classes.count} onChange={count => set({ classes: { ...draft.classes!, count } })} />
                </Field>
              </>
            )}
          </div>
          <p className="crt-form__hint">
            {grouped ? "Cada clase incluye su límite inferior y no el superior; la última incluye los dos. Sin número de clases, se usan las que hagan falta. " : "Cada valor distinto es una fila. "}
            {DATA_HINT}
          </p>
        </div>
      )}
      {source === "values" && (
        <div key={`values-${version}`} className="crt-form__group">
          <span className="crt-form__legend">Valores, de menor a mayor, y su frecuencia</span>
          <ValueRows rows={draft.values ?? []} onChange={values => set({ values })} />
        </div>
      )}
      {source === "categories" && (
        <div key={`categories-${version}`} className="crt-form__group">
          <span className="crt-form__legend">Categorías y su frecuencia</span>
          <CategoryRows rows={draft.categories ?? []} onChange={categories => set({ categories })} />
        </div>
      )}
      <p className="crt-form__hint" aria-live="polite">
        {frequencySummary(draft)}
      </p>

      <span className="crt-form__legend">Columnas</span>
      <div className="crt-form__row">
        {grouped && <Check label="Marca de clase" checked={draft.classMark} onChange={classMark => set({ classMark })} />}
        {RELATIVE_OPTIONS.map(option => (
          <Check key={option.format} label={`Relativa: ${option.label.toLowerCase()}`} checked={draft.relative.includes(option.format)} onChange={on => set({ relative: RELATIVE_OPTIONS.map(item => item.format).filter(format => (format === option.format ? on : draft.relative.includes(format))) })} />
        ))}
        <Check label="Acumulada" checked={draft.cumulative} onChange={cumulative => set({ cumulative })} />
        <Check label="Relativa acumulada" checked={draft.cumulativeRelative} onChange={cumulativeRelative => set({ cumulativeRelative })} />
        <Check label="Fila de totales" checked={draft.totals} onChange={totals => set({ totals })} />
      </div>

      <span className="crt-form__legend">Medidas bajo la tabla</span>
      <div className="crt-form__row">
        {MEASURE_OPTIONS.filter(option => source !== "categories" || option.key === "mode").map(option => (
          <Check key={option.key} label={option.label} checked={draft.measures.includes(option.key)} onChange={on => set({ measures: MEASURE_OPTIONS.map(item => item.key).filter(key => (key === option.key ? on : draft.measures.includes(key))) })} />
        ))}
      </div>

      <span className="crt-form__legend">En blanco (las completa el estudiante)</span>
      <div className="crt-form__row">
        {blankOptions
          .filter(option => option.shown)
          .map(option => (
            <Check key={option.key} label={option.label} checked={draft.blank.includes(option.key)} onChange={on => set({ blank: toggle(draft.blank, option.key, on) })} />
          ))}
      </div>
      <p className="crt-form__hint">Las frecuencias, los totales y las medidas se calculan solos. Si una frecuencia relativa no es exacta, se redondea de modo que la columna sume 1 (100 %) y la tabla lo dice en una nota.</p>
      <TableCaption value={draft.caption} onChange={caption => set({ caption })} />
    </>
  );
}

function TableCaption({ value, onChange }: { value: string | undefined; onChange: (value: string | undefined) => void }) {
  return (
    <div className="crt-form__row">
      <Field label="Pie de la tabla (opcional)" wide>
        <input className="crt-input" value={value ?? ""} onChange={event => onChange(event.target.value || undefined)} />
      </Field>
    </div>
  );
}

/* ── Tabla de contingencia ── */

type ContingencyDraft = Draft<"contingency_table">;

const DISPLAY_OPTIONS: readonly SelectOption<ContingencyDraft["display"]>[] = [
  { value: "counts", label: "Conteos" },
  { value: "fraction", label: "Frecuencia relativa: fracción" },
  { value: "decimal", label: "Frecuencia relativa: decimal" },
  { value: "percent", label: "Frecuencia relativa: porcentaje" },
];

const sameCell = (a: { row: string; column: string }, b: { row: string; column: string }) => a.row.trim().toLowerCase() === b.row.trim().toLowerCase() && a.column.trim().toLowerCase() === b.column.trim().toLowerCase();

export function ContingencyTableForm({ draft, onChange }: FormProps<"contingency_table">) {
  const [version, bump] = useListVersion();
  const columnCount = draft.columns.length;
  const sums = contingencyTotals(draft);

  /** Cambia los rótulos y lleva las celdas en blanco con ellos: una celda marcada sigue marcada aunque su fila cambie de nombre. */
  const relabel = (next: ContingencyDraft) => {
    const rowName = (label: string) => {
      const index = draft.rows.findIndex(row => row.label.trim().toLowerCase() === label.trim().toLowerCase());
      return index === -1 ? label : (next.rows[index]?.label ?? label);
    };
    const columnName = (label: string) => {
      const index = draft.columns.findIndex(column => column.trim().toLowerCase() === label.trim().toLowerCase());
      return index === -1 ? label : (next.columns[index] ?? label);
    };
    onChange({ ...next, blank: next.blank.map(cell => ({ row: rowName(cell.row), column: columnName(cell.column) })) });
  };

  /** Quita una fila o columna y las celdas en blanco que estaban en ella. */
  const remove = (next: ContingencyDraft, gone: { row?: string; column?: string }) => {
    const lost = (cell: { row: string; column: string }) => (gone.row !== undefined && cell.row.trim().toLowerCase() === gone.row.trim().toLowerCase()) || (gone.column !== undefined && cell.column.trim().toLowerCase() === gone.column.trim().toLowerCase());
    onChange({ ...next, blank: next.blank.filter(cell => !lost(cell)) });
    bump();
  };

  const rowNames = [...draft.rows.map(row => row.label), ...(draft.totals ? ["Total"] : [])];
  const columnNames = [...draft.columns, ...(draft.totals ? ["Total"] : [])];
  const isBlank = (row: string, column: string) => draft.blank.some(cell => sameCell(cell, { row, column }));
  const setBlank = (row: string, column: string, on: boolean) => onChange({ ...draft, blank: on ? [...draft.blank, { row, column }] : draft.blank.filter(cell => !sameCell(cell, { row, column })) });
  // Los rótulos de las columnas ganan ancho frente a los de las filas: en el panel angosto se cortaban primero
  const grid = { gridTemplateColumns: `minmax(72px, 0.9fr) repeat(${columnCount}, minmax(56px, 1fr)) 36px` };

  return (
    <>
      <div className="crt-form__row">
        <TextField label="Variable de las filas" value={draft.rowVariable} onChange={rowVariable => onChange({ ...draft, rowVariable })} />
        <TextField label="Variable de las columnas" value={draft.columnVariable} onChange={columnVariable => onChange({ ...draft, columnVariable })} />
      </div>

      <span className="crt-form__legend">Conteos</span>
      <div key={version} className="crt-ctab-form" style={grid}>
        <span />
        {draft.columns.map((column, c) => (
          <input key={c} className="crt-input" aria-label={`Rótulo de la columna ${c + 1}`} value={column} onChange={event => relabel({ ...draft, columns: draft.columns.map((current, i) => (i === c ? event.target.value : current)) })} />
        ))}
        <span />
        {draft.rows.map((row, r) => (
          <div key={r} className="crt-ctab-form__row">
            <input className="crt-input" aria-label={`Rótulo de la fila ${r + 1}`} value={row.label} onChange={event => relabel({ ...draft, rows: draft.rows.map((current, i) => (i === r ? { ...current, label: event.target.value } : current)) })} />
            {draft.columns.map((column, c) => (
              <NumberInput
                key={c}
                label={`Conteo de ${row.label || `la fila ${r + 1}`} y ${column || `la columna ${c + 1}`}`}
                value={row.counts[c] ?? 0}
                onChange={count => onChange({ ...draft, rows: draft.rows.map((current, i) => (i === r ? { ...current, counts: draft.columns.map((_, k) => (k === c ? count : (current.counts[k] ?? 0))) } : current)) })}
              />
            ))}
            {draft.rows.length > 2 ? <RemoveButton label={`Quitar la fila ${r + 1}`} onClick={() => remove({ ...draft, rows: draft.rows.filter((_, i) => i !== r) }, { row: row.label })} /> : <span />}
          </div>
        ))}
        <span />
        {draft.columns.map((column, c) =>
          columnCount > 2 ? (
            <RemoveButton key={c} label={`Quitar la columna ${c + 1}`} onClick={() => remove({ ...draft, columns: draft.columns.filter((_, i) => i !== c), rows: draft.rows.map(row => ({ ...row, counts: row.counts.filter((_, i) => i !== c) })) }, { column })} />
          ) : (
            <span key={c} />
          ),
        )}
        <span />
      </div>
      <div className="crt-form__row">
        {draft.rows.length < CREATOR_LIMITS.contingencyRowsMax && (
          <AddButton
            onClick={() => {
              onChange({ ...draft, rows: [...draft.rows, { label: `Fila ${draft.rows.length + 1}`, counts: draft.columns.map(() => 0) }] });
              bump();
            }}
          >
            Añadir fila
          </AddButton>
        )}
        {columnCount < CREATOR_LIMITS.contingencyColumnsMax && (
          <AddButton
            onClick={() => {
              onChange({ ...draft, columns: [...draft.columns, `Columna ${columnCount + 1}`], rows: draft.rows.map(row => ({ ...row, counts: [...row.counts, 0] })) });
              bump();
            }}
          >
            Añadir columna
          </AddButton>
        )}
      </div>

      <div className="crt-form__row">
        <Field label="Mostrar">
          <OptionSelect className="crt-input" value={draft.display} options={DISPLAY_OPTIONS} onValueChange={display => onChange({ ...draft, display })} />
        </Field>
        <Check
          label="Totales"
          checked={draft.totals}
          onChange={totals => onChange({ ...draft, totals, blank: totals ? draft.blank : draft.blank.filter(cell => cell.row.trim().toLowerCase() !== "total" && cell.column.trim().toLowerCase() !== "total") })}
        />
      </div>

      <span className="crt-form__legend">En blanco (las completa el estudiante)</span>
      <div className="crt-ctab-form crt-ctab-form--blank" style={{ gridTemplateColumns: `minmax(96px, 1.3fr) repeat(${columnNames.length}, minmax(48px, 1fr))` }} role="group" aria-label="Celdas en blanco">
        <span />
        {columnNames.map((column, c) => (
          <span key={c} className="crt-ctab-form__head">
            {column}
          </span>
        ))}
        {rowNames.map((row, r) => (
          <div key={r} className="crt-ctab-form__row">
            <span className="crt-ctab-form__head">{row}</span>
            {columnNames.map((column, c) => (
              <label key={c} className="crt-ctab-form__check">
                <input type="checkbox" aria-label={`Dejar en blanco ${row} y ${column}`} checked={isBlank(row, column)} onChange={event => setBlank(row, column, event.target.checked)} />
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="crt-form__hint" aria-live="polite">
        {sums ? `Total general: ${sums.total}. Los totales y las frecuencias relativas se calculan solos; la IA recibe las probabilidades condicionales que se desprenden de la tabla.` : "Cada fila necesita un conteo por columna."}
      </p>
      <TableCaption value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
    </>
  );
}
