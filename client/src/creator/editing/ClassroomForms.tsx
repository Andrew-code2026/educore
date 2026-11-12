import { PICTOGRAM_ICONS, type BlockInput } from "@shared/creator";
import { baseTenValue, clockText, formatProbability, textToTree, treePaths, treeToText, vennRegionName, vennRegionsFor, type VennRegion } from "@shared/creatorDiagrams";
import { parseNumberList } from "@shared/creatorFigures";
import { formatNumberEs } from "@shared/creatorMath";
import { BlockPreview, CaptionField, Check, Field, NumberInput, TextField, type Draft, type FormProps } from "./fields";
import { AddButton, DataRows, RemoveButton, useListVersion } from "./FigureForms";

type ClassroomType = "angle" | "venn" | "tree_diagram" | "bar_model" | "pictogram" | "clock" | "base_ten";

/** Contenido inicial de las figuras de aula al añadirlas desde «Añadir bloque». */
export const CLASSROOM_TEMPLATES: { [T in ClassroomType]: Extract<BlockInput, { type: T }> } = {
  angle: { type: "angle", angles: [{ degrees: 60 }], showMeasures: true, protractor: false },
  venn: {
    type: "venn",
    sets: ["Conjunto A", "Conjunto B"],
    regions: [
      { region: "a", text: "8", shaded: false },
      { region: "ab", text: "5", shaded: false },
      { region: "b", text: "6", shaded: false },
    ],
  },
  tree_diagram: {
    type: "tree_diagram",
    branches: [
      { label: "Cara", probability: "1/2", children: [{ label: "Cara", probability: "1/2", children: [] }, { label: "Sello", probability: "1/2", children: [] }] },
      { label: "Sello", probability: "1/2", children: [{ label: "Cara", probability: "1/2", children: [] }, { label: "Sello", probability: "1/2", children: [] }] },
    ],
    showResults: false,
  },
  bar_model: { type: "bar_model", bars: [{ parts: [{ value: 12 }, { value: 8, label: "?" }], total: "20" }] },
  pictogram: {
    type: "pictogram",
    title: "Título del pictograma",
    icon: "star",
    iconValue: 2,
    unit: "votos",
    rows: [
      { label: "Categoría 1", value: 8 },
      { label: "Categoría 2", value: 5 },
      { label: "Categoría 3", value: 3 },
    ],
    blank: false,
  },
  clock: { type: "clock", clocks: [{ hour: 7, minute: 30 }], showHands: true, showTime: false },
  base_ten: { type: "base_ten", hundreds: 1, tens: 3, ones: 5, showNumber: false },
};

export function AngleForm({ draft, onChange }: FormProps<"angle">) {
  const [version, bump] = useListVersion();
  type Item = Draft<"angle">["angles"][number];
  const setAngle = (index: number, patch: Partial<Item>) => onChange({ ...draft, angles: draft.angles.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  return (
    <>
      {draft.angles.map((angle, index) => (
        <div key={`${version}-${index}`} className="crt-form__row">
          <Field label={`Ángulo ${index + 1} (grados)`}>
            <NumberInput label={`Medida del ángulo ${index + 1} en grados`} value={angle.degrees} onChange={degrees => setAngle(index, { degrees })} />
          </Field>
          <TextField label="Rótulo (opcional)" value={angle.label} onChange={label => setAngle(index, { label })} />
          {draft.angles.length > 1 && (
            <RemoveButton
              label={`Quitar el ángulo ${index + 1}`}
              onClick={() => {
                onChange({ ...draft, angles: draft.angles.filter((_, i) => i !== index) });
                bump();
              }}
            />
          )}
        </div>
      ))}
      <div className="crt-form__row">
        {draft.angles.length < 3 && <AddButton onClick={() => onChange({ ...draft, angles: [...draft.angles, { degrees: 90 }] })}>Añadir ángulo</AddButton>}
        <Check label="Escribir la medida" checked={draft.showMeasures} onChange={showMeasures => onChange({ ...draft, showMeasures })} />
        <Check label="Con transportador" checked={draft.protractor} onChange={protractor => onChange({ ...draft, protractor })} />
      </div>
      <p className="crt-form__hint">El rótulo reemplaza a la medida y admite fórmulas: $\alpha$, x. Sin medida y con transportador, el estudiante mide el ángulo.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function VennForm({ draft, onChange }: FormProps<"venn">) {
  const [version, bump] = useListVersion();
  const three = draft.sets.length >= 3;
  const zones = vennRegionsFor(draft.sets.length);
  // Solo se guardan las zonas que llevan algo: las demás quedan vacías para el estudiante
  const setRegion = (region: VennRegion, patch: { text?: string; shaded?: boolean }) => {
    const current = draft.regions.find(item => item.region === region) ?? { region, shaded: false };
    const next = { ...current, ...patch };
    const others = draft.regions.filter(item => item.region !== region);
    onChange({ ...draft, regions: next.text || next.shaded ? [...others, next] : others });
  };
  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <TextField label="Conjunto universal (opcional)" value={draft.universe} onChange={universe => onChange({ ...draft, universe })} />
      </div>
      <div key={`sets-${version}`} className="crt-form__row">
        {draft.sets.map((name, index) => (
          <Field key={index} label={`Conjunto ${"ABC"[index]}`}>
            <input className="crt-input" value={name} onChange={event => onChange({ ...draft, sets: draft.sets.map((current, i) => (i === index ? event.target.value : current)) })} />
          </Field>
        ))}
        {three ? (
          <button
            type="button"
            className="crt-btn crt-btn--ghost crt-btn--sm"
            onClick={() => {
              const valid = vennRegionsFor(2);
              onChange({ ...draft, sets: draft.sets.slice(0, 2), regions: draft.regions.filter(item => valid.includes(item.region)) });
              bump();
            }}
          >
            Quitar el tercer conjunto
          </button>
        ) : (
          <AddButton
            onClick={() => {
              onChange({ ...draft, sets: [...draft.sets, "Conjunto C"] });
              bump();
            }}
          >
            Añadir tercer conjunto
          </AddButton>
        )}
      </div>

      <span className="crt-form__legend">Zonas</span>
      {zones.map(region => {
        const item = draft.regions.find(current => current.region === region);
        const name = capitalize(vennRegionName(region, draft.sets));
        return (
          <div key={`${version}-${region}`} className="crt-form__row">
            <Field label={name} wide>
              <input className="crt-input" aria-label={`Contenido de la zona ${name}`} placeholder="vacía" defaultValue={item?.text ?? ""} onChange={event => setRegion(region, { text: event.target.value.trim() || undefined })} />
            </Field>
            <Check label="Sombrear" checked={item?.shaded ?? false} onChange={shaded => setRegion(region, { shaded })} />
          </div>
        );
      })}
      <p className="crt-form__hint">Escribe una cantidad (12) o los elementos (2, 4, 6). Una zona vacía queda en blanco para que el estudiante la complete.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function TreeDiagramForm({ draft, onChange }: FormProps<"tree_diagram">) {
  const paths = treePaths(draft.branches);
  const complete = paths.length > 0 && paths.every(path => path.probability !== null);
  return (
    <>
      <div className="crt-form__row">
        <TextField label="Punto de partida (opcional)" value={draft.root} onChange={root => onChange({ ...draft, root })} />
        <Check label="Escribir la probabilidad de cada camino" checked={draft.showResults} onChange={showResults => onChange({ ...draft, showResults })} />
      </div>
      <div className="crt-form__row">
        <Field label="Ramas: una por renglón, con dos espacios de sangría por nivel" wide>
          <textarea
            className="crt-input crt-input--code"
            rows={Math.min(14, Math.max(5, treeToText(draft.branches).split("\n").length + 1))}
            spellCheck={false}
            defaultValue={treeToText(draft.branches)}
            onChange={event => onChange({ ...draft, branches: textToTree(event.target.value) as Draft<"tree_diagram">["branches"] })}
          />
        </Field>
      </div>
      <p className="crt-form__hint">
        Al final de cada renglón va la probabilidad de la rama: 1/2, 0.25 o 25%. Hasta tres niveles. Las ramas que salen de un mismo punto deben sumar 1.{" "}
        {complete ? `Caminos: ${paths.map(path => `${path.labels.join("–")} = ${formatProbability(path.probability!)}`).join("; ")}.` : `${paths.length} caminos.`}
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function BarModelForm({ draft, onChange }: FormProps<"bar_model">) {
  const [version, bump] = useListVersion();
  type Bar = Draft<"bar_model">["bars"][number];
  const setBar = (index: number, patch: Partial<Bar>) => onChange({ ...draft, bars: draft.bars.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  const build = (values: number[], labels: Array<string | undefined>): Bar["parts"] => values.map((value, i) => ({ value, ...(labels[i] ? { label: labels[i] } : {}) }));
  return (
    <>
      {draft.bars.map((bar, index) => (
        <div key={`${version}-${index}`} className="crt-form__group">
          <div className="crt-form__row">
            <TextField label={`Barra ${index + 1}: nombre (opcional)`} value={bar.label} onChange={label => setBar(index, { label })} />
            <TextField label="Total sobre la llave (opcional)" value={bar.total} onChange={total => setBar(index, { total })} />
            {draft.bars.length > 1 && (
              <RemoveButton
                label={`Quitar la barra ${index + 1}`}
                onClick={() => {
                  onChange({ ...draft, bars: draft.bars.filter((_, i) => i !== index) });
                  bump();
                }}
              />
            )}
          </div>
          <div className="crt-form__row">
            <Field label="Tamaño de cada parte, separados por comas" wide>
              <input
                className="crt-input"
                spellCheck={false}
                aria-label={`Tamaño de las partes de la barra ${index + 1}`}
                defaultValue={bar.parts.map(part => part.value).join(", ")}
                onChange={event => setBar(index, { parts: build(parseNumberList(event.target.value), bar.parts.map(part => part.label)) })}
              />
            </Field>
            <Field label="Texto de cada parte, separados por ; (vacío = el valor)" wide>
              <input
                className="crt-input"
                aria-label={`Texto de las partes de la barra ${index + 1}`}
                defaultValue={bar.parts.some(part => part.label) ? bar.parts.map(part => part.label ?? "").join("; ") : ""}
                onChange={event => setBar(index, { parts: build(bar.parts.map(part => part.value), event.target.value.split(";").map(label => label.trim() || undefined)) })}
              />
            </Field>
          </div>
        </div>
      ))}
      {draft.bars.length < 4 && <AddButton onClick={() => onChange({ ...draft, bars: [...draft.bars, { parts: [{ value: 10 }] }] })}>Añadir barra</AddButton>}
      <p className="crt-form__hint">Todas las barras se dibujan a la misma escala, para poder compararlas. Usa «?» como texto de la parte o del total que el estudiante debe hallar.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

const ICON_LABELS: Record<(typeof PICTOGRAM_ICONS)[number], string> = { circle: "Círculo", star: "Estrella", person: "Persona", heart: "Corazón", square: "Cuadrado" };

export function PictogramForm({ draft, onChange }: FormProps<"pictogram">) {
  return (
    <>
      <div className="crt-form__row">
        <TextField label="Título" wide value={draft.title} onChange={title => onChange({ ...draft, title })} />
        <Field label="Dibujo">
          <select className="crt-input" value={draft.icon} onChange={event => onChange({ ...draft, icon: event.target.value as typeof draft.icon })}>
            {PICTOGRAM_ICONS.map(icon => (
              <option key={icon} value={icon}>
                {ICON_LABELS[icon]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="crt-form__row">
        <Field label="Cada dibujo vale">
          <NumberInput label="Valor de cada dibujo" value={draft.iconValue} onChange={iconValue => onChange({ ...draft, iconValue })} />
        </Field>
        <TextField label="Qué cuenta (para la clave)" value={draft.unit} onChange={unit => onChange({ ...draft, unit })} />
        <Check label="Sin dibujos (los hace el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>
      <span className="crt-form__legend">Filas</span>
      <DataRows rows={draft.rows} max={8} noun="la fila" onChange={rows => onChange({ ...draft, rows })} />
      <p className="crt-form__hint">Escribe la cantidad real de cada fila; los dibujos se calculan solos. Con dibujos de 2, un 5 se dibuja como dos dibujos y medio.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function ClockForm({ draft, onChange }: FormProps<"clock">) {
  const [version, bump] = useListVersion();
  type Item = Draft<"clock">["clocks"][number];
  const setClock = (index: number, patch: Partial<Item>) => onChange({ ...draft, clocks: draft.clocks.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  return (
    <>
      {draft.clocks.map((clock, index) => (
        <div key={`${version}-${index}`} className="crt-form__row">
          <Field label={`Reloj ${index + 1}: hora`}>
            <NumberInput label={`Hora del reloj ${index + 1}`} value={clock.hour} onChange={hour => setClock(index, { hour })} />
          </Field>
          <Field label="Minutos">
            <NumberInput label={`Minutos del reloj ${index + 1}`} value={clock.minute} onChange={minute => setClock(index, { minute })} />
          </Field>
          <TextField label="Texto debajo (opcional)" value={clock.label} onChange={label => setClock(index, { label })} />
          {draft.clocks.length > 1 && (
            <RemoveButton
              label={`Quitar el reloj ${index + 1}`}
              onClick={() => {
                onChange({ ...draft, clocks: draft.clocks.filter((_, i) => i !== index) });
                bump();
              }}
            />
          )}
        </div>
      ))}
      <div className="crt-form__row">
        {draft.clocks.length < 4 && <AddButton onClick={() => onChange({ ...draft, clocks: [...draft.clocks, { hour: 3, minute: 0 }] })}>Añadir reloj</AddButton>}
        <Check label="Dibujar las manecillas" checked={draft.showHands} onChange={showHands => onChange({ ...draft, showHands })} />
        <Check label="Escribir la hora debajo" checked={draft.showTime} onChange={showTime => onChange({ ...draft, showTime })} />
      </div>
      <p className="crt-form__hint">
        Con manecillas y sin hora, el estudiante lee el reloj ({draft.clocks.map(clock => (Number.isFinite(clock.hour) && Number.isFinite(clock.minute) ? clockText(clock.hour, clock.minute) : "…")).join(", ")}). Sin manecillas y con hora, las dibuja.
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function BaseTenForm({ draft, onChange }: FormProps<"base_ten">) {
  const total = baseTenValue(draft);
  return (
    <>
      <div className="crt-form__row">
        <Field label="Centenas (placas)">
          <NumberInput label="Número de centenas" value={draft.hundreds} onChange={hundreds => onChange({ ...draft, hundreds })} />
        </Field>
        <Field label="Decenas (barras)">
          <NumberInput label="Número de decenas" value={draft.tens} onChange={tens => onChange({ ...draft, tens })} />
        </Field>
        <Field label="Unidades (cubos)">
          <NumberInput label="Número de unidades" value={draft.ones} onChange={ones => onChange({ ...draft, ones })} />
        </Field>
        <Check label="Escribir el número" checked={draft.showNumber} onChange={showNumber => onChange({ ...draft, showNumber })} />
      </div>
      <p className="crt-form__hint">
        {Number.isFinite(total) ? `Los bloques forman el ${formatNumberEs(total)}. ` : ""}Hasta 9 centenas y 19 decenas o unidades: más de 9 sirve para mostrar un reagrupamiento.
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}
