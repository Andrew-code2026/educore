import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SHAPE_KIND_LABELS, type ShapeFigure } from "@shared/creator";
import { parseNumberList } from "@shared/creatorFigures";
import { BlockPreview, CaptionField, Check, Field, NumberInput, OptionalNumberInput, type FormProps } from "./fields";

/**
 * Formularios de las figuras. Las listas usan campos numéricos sin controlar, así que
 * al quitar un elemento se cambia la clave de la lista para que los demás se vuelvan a pintar.
 */
export function useListVersion() {
  const [version, setVersion] = useState(0);
  return [version, () => setVersion(current => current + 1)] as const;
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="crt-icon-btn crt-icon-btn--danger" aria-label={label} onClick={onClick}>
      <Trash2 aria-hidden="true" />
    </button>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="crt-btn crt-btn--ghost crt-btn--sm" onClick={onClick}>
      <Plus aria-hidden="true" />
      {children}
    </button>
  );
}

const latexInput = (value: string | undefined, label: string, placeholder: string, onChange: (value: string | undefined) => void) => (
  <input className="crt-input crt-input--code" aria-label={label} spellCheck={false} placeholder={placeholder} value={value ?? ""} onChange={event => onChange(event.target.value || undefined)} />
);

export function NumberLineForm({ draft, onChange }: FormProps<"number_line">) {
  const [version, bump] = useListVersion();
  return (
    <>
      <div className="crt-form__row">
        <Field label="Desde">
          <NumberInput label="Valor inicial" value={draft.min} onChange={min => onChange({ ...draft, min })} />
        </Field>
        <Field label="Hasta">
          <NumberInput label="Valor final" value={draft.max} onChange={max => onChange({ ...draft, max })} />
        </Field>
        <Field label="Paso">
          <NumberInput label="Separación entre marcas" value={draft.step} onChange={step => onChange({ ...draft, step })} />
        </Field>
        <Field label="Número cada… marcas">
          <NumberInput label="Cada cuántas marcas se escribe el número" value={draft.labelEvery} onChange={labelEvery => onChange({ ...draft, labelEvery })} />
        </Field>
        <Field label="Denominador (fracciones)">
          <OptionalNumberInput label="Denominador de las fracciones" value={draft.fractionDenominator} onChange={fractionDenominator => onChange({ ...draft, fractionDenominator })} />
        </Field>
        <Check label="Mostrar los números" checked={draft.showNumbers} onChange={showNumbers => onChange({ ...draft, showNumbers })} />
      </div>

      <span className="crt-form__legend">Puntos marcados</span>
      {draft.points.map((point, index) => (
        <div key={`${version}-p${index}`} className="crt-form__item">
          <NumberInput label={`Valor del punto ${index + 1}`} value={point.value} onChange={value => onChange({ ...draft, points: draft.points.map((p, i) => (i === index ? { ...p, value } : p)) })} />
          {latexInput(point.label, `Rótulo del punto ${index + 1} en LaTeX`, "\\frac{3}{4}", label => onChange({ ...draft, points: draft.points.map((p, i) => (i === index ? { ...p, label } : p)) }))}
          <RemoveButton
            label={`Quitar el punto ${index + 1}`}
            onClick={() => {
              onChange({ ...draft, points: draft.points.filter((_, i) => i !== index) });
              bump();
            }}
          />
        </div>
      ))}
      {draft.points.length < 8 && <AddButton onClick={() => onChange({ ...draft, points: [...draft.points, { value: draft.min }] })}>Añadir punto</AddButton>}

      <span className="crt-form__legend">Saltos (sumas y restas)</span>
      {draft.jumps.map((jump, index) => (
        <div key={`${version}-j${index}`} className="crt-form__item">
          <NumberInput label={`Inicio del salto ${index + 1}`} value={jump.from} onChange={from => onChange({ ...draft, jumps: draft.jumps.map((j, i) => (i === index ? { ...j, from } : j)) })} />
          <NumberInput label={`Fin del salto ${index + 1}`} value={jump.to} onChange={to => onChange({ ...draft, jumps: draft.jumps.map((j, i) => (i === index ? { ...j, to } : j)) })} />
          {latexInput(jump.label, `Rótulo del salto ${index + 1} en LaTeX`, "+2", label => onChange({ ...draft, jumps: draft.jumps.map((j, i) => (i === index ? { ...j, label } : j)) }))}
          <RemoveButton
            label={`Quitar el salto ${index + 1}`}
            onClick={() => {
              onChange({ ...draft, jumps: draft.jumps.filter((_, i) => i !== index) });
              bump();
            }}
          />
        </div>
      ))}
      {draft.jumps.length < 6 && <AddButton onClick={() => onChange({ ...draft, jumps: [...draft.jumps, { from: draft.min, to: draft.min + draft.step }] })}>Añadir salto</AddButton>}

      <span className="crt-form__legend">Intervalos e inecuaciones</span>
      {draft.intervals.map((interval, index) => {
        const patchInterval = (patch: Partial<typeof interval>) => onChange({ ...draft, intervals: draft.intervals.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
        return (
          <div key={`${version}-i${index}`} className="crt-form__row">
            <Field label="Desde">
              <OptionalNumberInput label={`Extremo izquierdo del intervalo ${index + 1}`} value={interval.from ?? undefined} onChange={from => patchInterval({ from: from ?? null })} />
            </Field>
            <Field label="Hasta">
              <OptionalNumberInput label={`Extremo derecho del intervalo ${index + 1}`} value={interval.to ?? undefined} onChange={to => patchInterval({ to: to ?? null })} />
            </Field>
            <Check label="Incluye el izquierdo" checked={interval.fromClosed} onChange={fromClosed => patchInterval({ fromClosed })} />
            <Check label="Incluye el derecho" checked={interval.toClosed} onChange={toClosed => patchInterval({ toClosed })} />
            <RemoveButton
              label={`Quitar el intervalo ${index + 1}`}
              onClick={() => {
                onChange({ ...draft, intervals: draft.intervals.filter((_, i) => i !== index) });
                bump();
              }}
            />
          </div>
        );
      })}
      {draft.intervals.length < 3 && (
        <AddButton onClick={() => onChange({ ...draft, intervals: [...draft.intervals, { from: draft.min + draft.step, to: null, fromClosed: false, toClosed: false }] })}>Añadir intervalo</AddButton>
      )}
      {draft.intervals.length > 0 && <p className="crt-form__hint">Deja vacío un extremo para una semirrecta: «desde 2» sin «hasta» dibuja x &gt; 2. Un extremo incluido lleva círculo relleno.</p>}

      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function FractionModelForm({ draft, onChange }: FormProps<"fraction_model">) {
  const [version, bump] = useListVersion();
  return (
    <>
      <div className="crt-form__row">
        <Field label="Forma">
          <select className="crt-input" value={draft.shape} onChange={event => onChange({ ...draft, shape: event.target.value as typeof draft.shape })}>
            <option value="circle">Círculos</option>
            <option value="bar">Barras</option>
          </select>
        </Field>
        <Field label="Signo entre modelos">
          <select className="crt-input" value={draft.operator} onChange={event => onChange({ ...draft, operator: event.target.value as typeof draft.operator })}>
            <option value="none">Ninguno</option>
            <option value="equals">Igual (=)</option>
            <option value="plus">Más (+)</option>
            <option value="compare">Círculo para comparar</option>
          </select>
        </Field>
        <Check label="Mostrar las fracciones" checked={draft.showLabels} onChange={showLabels => onChange({ ...draft, showLabels })} />
      </div>

      <span className="crt-form__legend">Modelos (partes sombreadas / partes del entero)</span>
      {draft.models.map((model, index) => (
        <div key={`${version}-${index}`} className="crt-form__item">
          <NumberInput label={`Numerador del modelo ${index + 1}`} value={model.numerator} onChange={numerator => onChange({ ...draft, models: draft.models.map((m, i) => (i === index ? { ...m, numerator } : m)) })} />
          <NumberInput label={`Denominador del modelo ${index + 1}`} value={model.denominator} onChange={denominator => onChange({ ...draft, models: draft.models.map((m, i) => (i === index ? { ...m, denominator } : m)) })} />
          {latexInput(model.label, `Rótulo del modelo ${index + 1} en LaTeX`, "automático", label => onChange({ ...draft, models: draft.models.map((m, i) => (i === index ? { ...m, label } : m)) }))}
          <RemoveButton
            label={`Quitar el modelo ${index + 1}`}
            onClick={() => {
              onChange({ ...draft, models: draft.models.filter((_, i) => i !== index) });
              bump();
            }}
          />
        </div>
      ))}
      {draft.models.length < 4 && <AddButton onClick={() => onChange({ ...draft, models: [...draft.models, { numerator: 1, denominator: 4 }] })}>Añadir modelo</AddButton>}

      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

/** Lista de categorías con valor, común a barras y sectores. */
export function DataRows({ rows, max, noun, onChange }: { rows: Array<{ label: string; value: number }>; max: number; noun: string; onChange: (rows: Array<{ label: string; value: number }>) => void }) {
  const [version, bump] = useListVersion();
  return (
    <>
      {rows.map((row, index) => (
        <div key={`${version}-${index}`} className="crt-form__item">
          <input className="crt-input" aria-label={`Nombre de ${noun} ${index + 1}`} value={row.label} onChange={event => onChange(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))} />
          <NumberInput label={`Valor de ${noun} ${index + 1}`} value={row.value} onChange={value => onChange(rows.map((r, i) => (i === index ? { ...r, value } : r)))} />
          <RemoveButton
            label={`Quitar ${noun} ${index + 1}`}
            onClick={() => {
              onChange(rows.filter((_, i) => i !== index));
              bump();
            }}
          />
        </div>
      ))}
      {rows.length < max && <AddButton onClick={() => onChange([...rows, { label: `Categoría ${rows.length + 1}`, value: 1 }])}>Añadir {noun}</AddButton>}
    </>
  );
}

export function BarChartForm({ draft, onChange }: FormProps<"bar_chart">) {
  return (
    <>
      <div className="crt-form__row">
        <Field label="Título" wide>
          <input className="crt-input" value={draft.title ?? ""} onChange={event => onChange({ ...draft, title: event.target.value || undefined })} />
        </Field>
        <Field label="Eje horizontal">
          <input className="crt-input" value={draft.xLabel ?? ""} onChange={event => onChange({ ...draft, xLabel: event.target.value || undefined })} />
        </Field>
        <Field label="Eje vertical">
          <input className="crt-input" value={draft.yLabel ?? ""} onChange={event => onChange({ ...draft, yLabel: event.target.value || undefined })} />
        </Field>
      </div>
      <div className="crt-form__row">
        <Field label="Tope del eje">
          <OptionalNumberInput label="Tope del eje vertical" value={draft.yMax} onChange={yMax => onChange({ ...draft, yMax })} />
        </Field>
        <Field label="Paso del eje">
          <OptionalNumberInput label="Paso del eje vertical" value={draft.yStep} onChange={yStep => onChange({ ...draft, yStep })} />
        </Field>
        <Check label="Valor sobre cada barra" checked={draft.showValues} onChange={showValues => onChange({ ...draft, showValues })} />
        <Check label="Sin barras (las traza el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>
      <span className="crt-form__legend">Barras</span>
      <DataRows rows={draft.bars} max={12} noun="la barra" onChange={bars => onChange({ ...draft, bars })} />
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function PieChartForm({ draft, onChange }: FormProps<"pie_chart">) {
  return (
    <>
      <div className="crt-form__row">
        <Field label="Título" wide>
          <input className="crt-input" value={draft.title ?? ""} onChange={event => onChange({ ...draft, title: event.target.value || undefined })} />
        </Field>
        <Check label="Mostrar porcentajes" checked={draft.showPercent} onChange={showPercent => onChange({ ...draft, showPercent })} />
        <Check label="Sin sectores (lo construye el estudiante)" checked={draft.blank} onChange={blank => onChange({ ...draft, blank })} />
      </div>
      <span className="crt-form__legend">Sectores</span>
      <DataRows rows={draft.slices} max={8} noun="el sector" onChange={slices => onChange({ ...draft, slices })} />
      <p className="crt-form__hint">Escribe la cantidad de cada sector; los porcentajes se calculan solos y siempre suman 100.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

const SHAPE_TEMPLATES: Record<ShapeFigure["kind"], ShapeFigure> = {
  rectangle: { kind: "rectangle", width: 5, height: 3, widthLabel: "5 cm", heightLabel: "3 cm" },
  triangle: { kind: "triangle", base: 6, height: 4, apex: 0.5, baseLabel: "6 cm", heightLabel: "4 cm", showHeight: true },
  circle: { kind: "circle", radius: 2, show: "radius", label: "2 cm" },
  polygon: { kind: "polygon", vertices: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 4, y: 3 }, { x: 1, y: 3 }], sideLabels: ["6 cm", "", "3 cm", ""] },
};

const parseVertices = (text: string) =>
  text
    .split(";")
    .map(pair => pair.split(",").map(part => Number(part.trim().replace("−", "-"))))
    .filter(pair => pair.length === 2)
    .map(([x, y]) => ({ x, y }));

function ShapeFields({ figure, index, onChange }: { figure: ShapeFigure; index: number; onChange: (figure: ShapeFigure) => void }) {
  const text = (value: string | undefined, label: string, set: (value: string | undefined) => void) => (
    <Field label={label}>
      <input className="crt-input" value={value ?? ""} onChange={event => set(event.target.value || undefined)} />
    </Field>
  );
  switch (figure.kind) {
    case "rectangle":
      return (
        <>
          <Field label="Ancho">
            <NumberInput label={`Ancho de la figura ${index + 1}`} value={figure.width} onChange={width => onChange({ ...figure, width })} />
          </Field>
          <Field label="Alto">
            <NumberInput label={`Alto de la figura ${index + 1}`} value={figure.height} onChange={height => onChange({ ...figure, height })} />
          </Field>
          {text(figure.widthLabel, "Rótulo del ancho", widthLabel => onChange({ ...figure, widthLabel }))}
          {text(figure.heightLabel, "Rótulo del alto", heightLabel => onChange({ ...figure, heightLabel }))}
        </>
      );
    case "triangle":
      return (
        <>
          <Field label="Base">
            <NumberInput label={`Base de la figura ${index + 1}`} value={figure.base} onChange={base => onChange({ ...figure, base })} />
          </Field>
          <Field label="Altura">
            <NumberInput label={`Altura de la figura ${index + 1}`} value={figure.height} onChange={height => onChange({ ...figure, height })} />
          </Field>
          <Field label="Tipo">
            <select className="crt-input" value={String(figure.apex)} onChange={event => onChange({ ...figure, apex: Number(event.target.value) })}>
              <option value="0.5">Isósceles</option>
              <option value="0">Rectángulo</option>
              <option value="0.3">Escaleno</option>
              {![0, 0.3, 0.5].includes(figure.apex) && <option value={String(figure.apex)}>Personalizado</option>}
            </select>
          </Field>
          {text(figure.baseLabel, "Rótulo de la base", baseLabel => onChange({ ...figure, baseLabel }))}
          {text(figure.heightLabel, "Rótulo de la altura", heightLabel => onChange({ ...figure, heightLabel }))}
          <Check label="Dibujar la altura" checked={figure.showHeight} onChange={showHeight => onChange({ ...figure, showHeight })} />
        </>
      );
    case "circle":
      return (
        <>
          <Field label="Radio">
            <NumberInput label={`Radio de la figura ${index + 1}`} value={figure.radius} onChange={radius => onChange({ ...figure, radius })} />
          </Field>
          <Field label="Segmento">
            <select className="crt-input" value={figure.show} onChange={event => onChange({ ...figure, show: event.target.value as typeof figure.show })}>
              <option value="radius">Radio</option>
              <option value="diameter">Diámetro</option>
              <option value="none">Ninguno</option>
            </select>
          </Field>
          {text(figure.label, "Rótulo", label => onChange({ ...figure, label }))}
        </>
      );
    case "polygon":
      return (
        <>
          <Field label="Vértices (x, y; x, y; …)" wide>
            <input className="crt-input crt-input--code" defaultValue={figure.vertices.map(vertex => `${vertex.x}, ${vertex.y}`).join("; ")} onChange={event => onChange({ ...figure, vertices: parseVertices(event.target.value) })} />
          </Field>
          <Field label="Rótulos de los lados, separados por ;" wide>
            <input className="crt-input" defaultValue={figure.sideLabels.join("; ")} onChange={event => onChange({ ...figure, sideLabels: event.target.value.split(";").map(label => label.trim()) })} />
          </Field>
        </>
      );
  }
}

export function ShapesForm({ draft, onChange }: FormProps<"shapes">) {
  const [version, bump] = useListVersion();
  const setFigure = (index: number, figure: ShapeFigure) => onChange({ ...draft, figures: draft.figures.map((current, i) => (i === index ? figure : current)) });
  return (
    <>
      {draft.figures.map((figure, index) => (
        <div key={`${version}-${index}-${figure.kind}`} className="crt-form__group">
          <div className="crt-form__row">
            <Field label={`Figura ${index + 1}`}>
              <select
                className="crt-input"
                value={figure.kind}
                onChange={event => {
                  setFigure(index, SHAPE_TEMPLATES[event.target.value as ShapeFigure["kind"]]);
                  bump();
                }}
              >
                {(Object.keys(SHAPE_KIND_LABELS) as Array<ShapeFigure["kind"]>).map(kind => (
                  <option key={kind} value={kind}>
                    {SHAPE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </Field>
            <ShapeFields figure={figure} index={index} onChange={next => setFigure(index, next)} />
            {draft.figures.length > 1 && (
              <RemoveButton
                label={`Quitar la figura ${index + 1}`}
                onClick={() => {
                  onChange({ ...draft, figures: draft.figures.filter((_, i) => i !== index) });
                  bump();
                }}
              />
            )}
          </div>
        </div>
      ))}
      <div className="crt-form__row">
        {draft.figures.length < 4 && <AddButton onClick={() => onChange({ ...draft, figures: [...draft.figures, SHAPE_TEMPLATES.rectangle] })}>Añadir figura</AddButton>}
        <Check label="Todas a la misma escala" checked={draft.toScale} onChange={toScale => onChange({ ...draft, toScale })} />
      </div>
      <p className="crt-form__hint">Los rótulos admiten fórmulas entre signos de dólar, por ejemplo $r = 3$ cm.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}

export function BalanceForm({ draft, onChange }: FormProps<"balance">) {
  const side = (name: "left" | "right", title: string) => (
    <>
      <Field label={`${title}: incógnitas`}>
        <NumberInput label={`Incógnitas del platillo ${title.toLowerCase()}`} value={draft[name].variables} onChange={variables => onChange({ ...draft, [name]: { ...draft[name], variables } })} />
      </Field>
      <Field label={`${title}: unidades`}>
        <NumberInput label={`Unidades del platillo ${title.toLowerCase()}`} value={draft[name].units} onChange={units => onChange({ ...draft, [name]: { ...draft[name], units } })} />
      </Field>
      <Field label={`${title}: pesas con número`}>
        <input
          className="crt-input"
          aria-label={`Pesas con número del platillo ${title.toLowerCase()}, separadas por comas`}
          placeholder="15"
          defaultValue={draft[name].weights.join(", ")}
          onChange={event =>
            onChange({ ...draft, [name]: { ...draft[name], weights: parseNumberList(event.target.value) } })
          }
        />
      </Field>
    </>
  );
  return (
    <>
      <div className="crt-form__row">
        <Field label="Incógnita">
          <input className="crt-input crt-input--tiny" maxLength={1} value={draft.variable} onChange={event => onChange({ ...draft, variable: event.target.value })} />
        </Field>
        {side("left", "Izquierdo")}
        {side("right", "Derecho")}
      </div>
      <p className="crt-form__hint">La balanza se dibuja en equilibrio: representa una ecuación como 2x + 1 = 7. Para números grandes usa una pesa con número en vez de fichas: 2x + 5 = 15 lleva una pesa de 15 a la derecha.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}
