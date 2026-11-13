import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { CREATOR_LIMITS, type GraphArea, type GraphConic, type GraphFigure, type GraphFunction, type GraphInequality, type GraphNotable, type GraphSecant, type GraphTangent, type GraphTransform, type GraphVerticalLine } from "@shared/creator";
import { RIEMANN_SAMPLE_LABELS, type RiemannSample } from "@shared/creatorCalculus";
import { CONIC_LABELS, CONIC_SHOW_LABELS, CONIC_SHOWS, conicEquation, type ConicKind, type ConicShow } from "@shared/creatorConics";
import { NOTABLE_KIND_LABELS, describeNotable, type NotableKind } from "@shared/creatorNotable";
import type { EndStyle } from "@shared/creatorPlane";
import { AXIS_NAME_MAX } from "@shared/creatorPlaneAxes";
import { FIGURE_KIND_LABELS, FIGURE_SHOW_LABELS, FIGURE_SHOWS, MIRROR_LABELS, TRANSFORM_LABELS, describeFigure, type FigureKind, type FigureShow, type Mirror, type TransformKind } from "@shared/creatorPlaneGeometry";
import { INEQUALITY_OP_LABELS, REGION_SHADE_LABELS, describeInequalities, type InequalityOp, type RegionShade } from "@shared/creatorRegions";
import { Formula } from "../blocks/Formula";
import { Check, Field, NumberInput, OptionalNumberInput, type FormProps } from "./fields";
import { AddButton, RemoveButton, useListVersion } from "./FigureForms";

const END_OPTIONS: readonly SelectOption<EndStyle>[] = [
  { value: "closed", label: "Círculo relleno" },
  { value: "open", label: "Círculo vacío" },
  { value: "none", label: "Sin círculo" },
];

type Stroke = NonNullable<GraphFunction["style"]>;

const STROKE_OPTIONS: readonly SelectOption<Stroke>[] = [
  { value: "solid", label: "Continuo" },
  { value: "dashed", label: "Punteado" },
];

const COLOR_OPTIONS: readonly SelectOption<number | "">[] = [
  { value: "", label: "Automático" },
  { value: 0, label: "Azul" },
  { value: 1, label: "Verde" },
  { value: 2, label: "Morado" },
  { value: 3, label: "Naranja" },
];

type LineShow = NonNullable<GraphTangent["show"]>;

const LINE_SHOW_OPTIONS: readonly SelectOption<LineShow>[] = [
  { value: "none", label: "Sin rótulo" },
  { value: "slope", label: "Escribir la pendiente" },
  { value: "equation", label: "Escribir la ecuación" },
];

const RIEMANN_SAMPLE_OPTIONS: readonly SelectOption<RiemannSample>[] = (Object.keys(RIEMANN_SAMPLE_LABELS) as RiemannSample[]).map(sample => ({
  value: sample,
  label: `Altura en el ${RIEMANN_SAMPLE_LABELS[sample]}`,
}));

const NOTABLE_KIND_OPTIONS: readonly SelectOption<NotableKind>[] = (Object.keys(NOTABLE_KIND_LABELS) as NotableKind[]).map(kind => ({ value: kind, label: NOTABLE_KIND_LABELS[kind] }));

const CONIC_KIND_OPTIONS: readonly SelectOption<ConicKind>[] = (Object.keys(CONIC_LABELS) as ConicKind[]).map(kind => ({ value: kind, label: CONIC_LABELS[kind] }));

/** Una cónica de cada tipo con el centro dado, para empezar a editarla. */
const conicTemplate = (kind: ConicKind, h = 0, k = 0): GraphConic => {
  switch (kind) {
    case "circle":
      return { kind, h, k, r: 3, show: ["center"] };
    case "ellipse":
      return { kind, h, k, rx: 4, ry: 2, show: ["center", "foci"] };
    case "parabola":
      return { kind, h, k, p: 1, axis: "vertical", show: ["foci", "directrix"] };
    case "hyperbola":
      return { kind, h, k, a: 2, b: 1.5, axis: "horizontal", show: ["foci", "asymptotes"] };
  }
};

const PARABOLA_AXIS_OPTIONS: readonly SelectOption<"vertical" | "horizontal">[] = [
  { value: "vertical", label: "Abre arriba o abajo" },
  { value: "horizontal", label: "Abre hacia un lado" },
];

const HYPERBOLA_AXIS_OPTIONS: readonly SelectOption<"horizontal" | "vertical">[] = [
  { value: "horizontal", label: "Ramas a los lados" },
  { value: "vertical", label: "Ramas arriba y abajo" },
];

/** Los parámetros propios de cada cónica. */
function ConicFields({ conic, index, onChange }: { conic: GraphConic; index: number; onChange: (next: GraphConic) => void }) {
  const number = (label: string, name: string, value: number, set: (value: number) => GraphConic) => (
    <Field label={label}>
      <NumberInput label={`${name} de la cónica ${index + 1}`} value={value} onChange={next => onChange(set(next))} />
    </Field>
  );
  const vertexOrCenter = conic.kind === "parabola" ? "vértice" : "centro";
  const shared = (
    <>
      {number(`x del ${vertexOrCenter}`, `x del ${vertexOrCenter}`, conic.h, h => ({ ...conic, h }))}
      {number(`y del ${vertexOrCenter}`, `y del ${vertexOrCenter}`, conic.k, k => ({ ...conic, k }))}
    </>
  );
  switch (conic.kind) {
    case "circle":
      return (
        <>
          {shared}
          {number("Radio", "Radio", conic.r, r => ({ ...conic, r }))}
        </>
      );
    case "ellipse":
      return (
        <>
          {shared}
          {number("Semieje horizontal", "Semieje horizontal", conic.rx, rx => ({ ...conic, rx }))}
          {number("Semieje vertical", "Semieje vertical", conic.ry, ry => ({ ...conic, ry }))}
        </>
      );
    case "parabola":
      return (
        <>
          {shared}
          {number("p (del vértice al foco)", "Parámetro p", conic.p, p => ({ ...conic, p }))}
          <Field label="Orientación">
            <OptionSelect className="crt-input" aria-label={`Orientación de la cónica ${index + 1}`} value={conic.axis} onValueChange={axis => onChange({ ...conic, axis })} options={PARABOLA_AXIS_OPTIONS} />
          </Field>
        </>
      );
    case "hyperbola":
      return (
        <>
          {shared}
          {number("a (al vértice)", "Semieje a", conic.a, a => ({ ...conic, a }))}
          {number("b", "Semieje b", conic.b, b => ({ ...conic, b }))}
          <Field label="Orientación">
            <OptionSelect className="crt-input" aria-label={`Orientación de la cónica ${index + 1}`} value={conic.axis} onValueChange={axis => onChange({ ...conic, axis })} options={HYPERBOLA_AXIS_OPTIONS} />
          </Field>
        </>
      );
  }
}

const INEQUALITY_OP_OPTIONS: readonly SelectOption<InequalityOp>[] = (Object.keys(INEQUALITY_OP_LABELS) as InequalityOp[]).map(op => ({ value: op, label: INEQUALITY_OP_LABELS[op] }));
const REGION_SHADE_OPTIONS: readonly SelectOption<RegionShade>[] = (Object.keys(REGION_SHADE_LABELS) as RegionShade[]).map(shade => ({ value: shade, label: REGION_SHADE_LABELS[shade] }));

const FIGURE_KIND_OPTIONS: readonly SelectOption<FigureKind>[] = (Object.keys(FIGURE_KIND_LABELS) as FigureKind[]).map(kind => ({ value: kind, label: FIGURE_KIND_LABELS[kind] }));
const TRANSFORM_OPTIONS: readonly SelectOption<TransformKind | "">[] = [{ value: "", label: "Ninguna" }, ...(Object.keys(TRANSFORM_LABELS) as TransformKind[]).map(kind => ({ value: kind, label: TRANSFORM_LABELS[kind] }))];
const MIRROR_OPTIONS: readonly SelectOption<Mirror>[] = (Object.keys(MIRROR_LABELS) as Mirror[]).map(over => ({ value: over, label: MIRROR_LABELS[over] }));

/** Vértices que necesita cada figura como mínimo. */
const FIGURE_MIN_VERTICES: Record<FigureKind, number> = { points: 1, segment: 2, polygon: 3 };

/** Lo que el campo del nombre deja escribir: una letra, un dígito opcional y hasta dos primas. */
const vertexNameOf = (raw: string): string | undefined => /^[A-Za-z]\d?'{0,2}/.exec(raw.trim())?.[0];

/** El vértice que sigue: junto al último y con la primera letra que no esté usada. */
function nextVertex(vertices: GraphFigure["vertices"]): GraphFigure["vertices"][number] {
  const last = vertices[vertices.length - 1];
  const used = new Set(vertices.map(vertex => vertex.name));
  const name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(letter => !used.has(letter));
  return { x: (last?.x ?? 0) + 1, y: (last?.y ?? 0) + 1, name };
}

/** Una figura de cada tipo para empezar a editarla. */
const figureTemplate = (kind: FigureKind): GraphFigure => {
  switch (kind) {
    case "points":
      return { kind, vertices: [{ x: 2, y: 3, name: "P" }], show: ["coordinates"] };
    case "segment":
      return { kind, vertices: [{ x: 1, y: 1, name: "A" }, { x: 4, y: 3, name: "B" }], show: ["lengths"] };
    case "polygon":
      return { kind, vertices: [{ x: 1, y: 1, name: "A" }, { x: 4, y: 1, name: "B" }, { x: 2, y: 3, name: "C" }] };
  }
};

/** La misma figura con otro tipo: conserva los vértices que sirven, completa los que faltan y quita lo que ya no puede mostrar. */
function withKind(figure: GraphFigure, kind: FigureKind): GraphFigure {
  let vertices = kind === "segment" ? figure.vertices.slice(0, 2) : [...figure.vertices];
  while (vertices.length < FIGURE_MIN_VERTICES[kind]) vertices = [...vertices, nextVertex(vertices)];
  const show = (figure.show ?? []).filter(item => FIGURE_SHOWS[kind].includes(item));
  return { ...figure, kind, vertices, show: show.length > 0 ? show : undefined };
}

const transformTemplate = (kind: TransformKind): GraphTransform => {
  switch (kind) {
    case "translation":
      return { kind, dx: 3, dy: -2 };
    case "reflection":
      return { kind, over: "y" };
    case "rotation":
      return { kind, cx: 0, cy: 0, angle: 90 };
    case "dilation":
      return { kind, cx: 0, cy: 0, factor: 2 };
  }
};

/** Los datos propios de cada transformación. */
function TransformFields({ transform, index, onChange }: { transform: GraphTransform; index: number; onChange: (next: GraphTransform) => void }) {
  const number = (label: string, value: number, set: (value: number) => GraphTransform) => (
    <Field label={label}>
      <NumberInput label={`${label} de la transformación de la figura ${index + 1}`} value={value} onChange={next => onChange(set(next))} />
    </Field>
  );
  switch (transform.kind) {
    case "translation":
      return (
        <>
          {number("Vector: en x", transform.dx, dx => ({ ...transform, dx }))}
          {number("Vector: en y", transform.dy, dy => ({ ...transform, dy }))}
        </>
      );
    case "reflection":
      return (
        <>
          <Field label="Eje de reflexión">
            <OptionSelect
              className="crt-input"
              aria-label={`Eje de reflexión de la figura ${index + 1}`}
              value={transform.over}
              // Cada eje lleva sus propios datos: los de otro no se arrastran
              onValueChange={over => onChange(over === "vertical" ? { kind: "reflection", over, at: 1 } : over === "line" ? { kind: "reflection", over, slope: 1, intercept: 0 } : { kind: "reflection", over })}
              options={MIRROR_OPTIONS}
            />
          </Field>
          {transform.over === "vertical" && number("Recta x =", transform.at ?? 0, at => ({ ...transform, at }))}
          {transform.over === "line" && number("Pendiente m", transform.slope ?? 0, slope => ({ ...transform, slope }))}
          {transform.over === "line" && number("Corte b", transform.intercept ?? 0, intercept => ({ ...transform, intercept }))}
        </>
      );
    case "rotation":
      return (
        <>
          {number("Centro: x", transform.cx, cx => ({ ...transform, cx }))}
          {number("Centro: y", transform.cy, cy => ({ ...transform, cy }))}
          {number("Ángulo (°, antihorario)", transform.angle, angle => ({ ...transform, angle }))}
        </>
      );
    case "dilation":
      return (
        <>
          {number("Centro: x", transform.cx, cx => ({ ...transform, cx }))}
          {number("Centro: y", transform.cy, cy => ({ ...transform, cy }))}
          {number("Razón", transform.factor, factor => ({ ...transform, factor }))}
        </>
      );
  }
}

/** ¿La función usa alguna de las opciones que el formulario guarda plegadas? */
const hasOptions = (fn: GraphFunction) => fn.from !== undefined || fn.to !== undefined || fn.color !== undefined || fn.style !== undefined;

export function GraphForm({ draft, onChange }: FormProps<"graph">) {
  const [listVersion, bump] = useListVersion();
  // Funciones con las opciones de dominio y color a la vista
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const spec = draft.spec;
  const setSpec = (patch: Partial<typeof spec>) => onChange({ ...draft, spec: { ...spec, ...patch } });
  const setFunction = (index: number, patch: Partial<GraphFunction>) => setSpec({ functions: spec.functions.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  const functionName = (index: number) => spec.functions[index]?.expr || `función ${index + 1}`;
  const verticalLines = spec.verticalLines ?? [];
  // Una lista que queda vacía se quita del bloque: así un plano sin rectas se guarda como antes
  const setVerticalLines = (next: GraphVerticalLine[]) => setSpec({ verticalLines: next.length > 0 ? next : undefined });
  const conics = spec.conics ?? [];
  const setConics = (next: GraphConic[]) => setSpec({ conics: next.length > 0 ? next : undefined });
  const setConic = (index: number, next: GraphConic) => setConics(conics.map((current, i) => (i === index ? next : current)));
  const areas = spec.areas ?? [];
  const setAreas = (next: GraphArea[]) => setSpec({ areas: next.length > 0 ? next : undefined });
  const functionOptions = spec.functions.map((_, i) => ({ value: i, label: functionName(i) }));
  const tangents = spec.tangents ?? [];
  const setTangents = (next: GraphTangent[]) => setSpec({ tangents: next.length > 0 ? next : undefined });
  const secants = spec.secants ?? [];
  const setSecants = (next: GraphSecant[]) => setSpec({ secants: next.length > 0 ? next : undefined });
  const inequalities = spec.inequalities ?? [];
  // Sin inecuaciones no queda nada que sombrear ni vértices que marcar: sus opciones se van con la última
  const setInequalities = (next: GraphInequality[]) => setSpec(next.length > 0 ? { inequalities: next } : { inequalities: undefined, inequalityShade: undefined, inequalityVertices: undefined });
  const regionFacts = describeInequalities(spec);
  const figures = spec.figures ?? [];
  const setFigures = (next: GraphFigure[]) => setSpec({ figures: next.length > 0 ? next : undefined });
  const setFigure = (index: number, next: GraphFigure) => setFigures(figures.map((current, i) => (i === index ? next : current)));
  const notable = spec.notable ?? [];
  const setNotable = (next: GraphNotable[]) => setSpec({ notable: next.length > 0 ? next : undefined });
  const piAxis = spec.xUnit === "pi";
  /** Al pasar a múltiplos de π el rango se lleva al múltiplo de π/2 más cercano; al volver, a enteros. */
  const togglePi = (on: boolean) => {
    const unit = on ? Math.PI / 2 : 1;
    const xMin = Math.round(spec.xMin / unit) * unit;
    const rounded = Math.round(spec.xMax / unit) * unit;
    const xMax = rounded > xMin ? rounded : xMin + 4 * unit;
    const marks = Math.round((xMax - xMin) / unit);
    setSpec({ xUnit: on ? "pi" : undefined, xMin, xMax, xStep: unit * Math.max(1, Math.ceil(marks / 20)) });
  };

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
        ).map(([key, label]) => {
          // Con el eje x en múltiplos de π, su rango y su paso se escriben en múltiplos de π (0,5 es π/2) y se guardan en radianes
          const inPi = piAxis && key.startsWith("x");
          const name = inPi ? `${label} (× π)` : label;
          return (
            <Field key={`${key}-${inPi}`} label={name}>
              <NumberInput label={name} value={inPi ? Number((spec[key] / Math.PI).toFixed(4)) : spec[key]} onChange={value => setSpec({ [key]: inPi ? value * Math.PI : value })} />
            </Field>
          );
        })}
        <Check label="Eje x en múltiplos de π" checked={piAxis} onChange={togglePi} />
      </div>
      <div className="crt-form__row">
        {(
          [
            ["xLabel", "Nombre del eje x (opcional)", "Tiempo (h)"],
            ["yLabel", "Nombre del eje y (opcional)", "Costo ($)"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <Field key={key} label={label}>
            <input className="crt-input" aria-label={label} maxLength={AXIS_NAME_MAX} placeholder={placeholder} value={spec[key] ?? ""} onChange={event => setSpec({ [key]: event.target.value || undefined })} />
          </Field>
        ))}
      </div>

      <span className="crt-form__legend">Funciones</span>
      {spec.functions.map((fn, index) => {
        const open = expanded.has(index) || hasOptions(fn);
        return (
          <div key={`${listVersion}-f${index}`} className="crt-form__stack">
            <div className="crt-form__item">
              <input className="crt-input crt-input--code" aria-label={`Función ${index + 1}`} spellCheck={false} placeholder="2*x - 3" value={fn.expr} onChange={event => setFunction(index, { expr: event.target.value })} />
              <input
                className="crt-input crt-input--code"
                aria-label={`Etiqueta de la función ${index + 1} en LaTeX`}
                spellCheck={false}
                placeholder="y = 2x - 3"
                value={fn.label ?? ""}
                onChange={event => setFunction(index, { label: event.target.value || undefined })}
              />
              {!open && (
                <button
                  type="button"
                  className="crt-icon-btn"
                  aria-label={`Dominio, trazo y color de la función ${index + 1}`}
                  title="Dominio, trazo y color"
                  onClick={() => setExpanded(current => new Set(current).add(index))}
                >
                  <SlidersHorizontal aria-hidden="true" />
                </button>
              )}
              <RemoveButton
                label={`Quitar la función ${index + 1}`}
                onClick={() => {
                  // Los puntos que estaban sobre esta función quedan libres; los de las siguientes se reindexan
                  const shift = (i: number) => (i > index ? i - 1 : i);
                  const points = spec.points.map(point => (point.on == null ? point : point.on === index ? { ...point, on: null } : { ...point, on: shift(point.on) }));
                  // Lo que se medía sobre esta función (regiones, tangentes y secantes) se va con ella
                  const keptAreas = areas.filter(area => area.fn !== index && area.between !== index).map(area => ({ ...area, fn: shift(area.fn), between: area.between === undefined ? undefined : shift(area.between) }));
                  const keptTangents = tangents.filter(tangent => tangent.fn !== index).map(tangent => ({ ...tangent, fn: shift(tangent.fn) }));
                  const keptSecants = secants.filter(secant => secant.fn !== index).map(secant => ({ ...secant, fn: shift(secant.fn) }));
                  const keptNotable = notable.filter(item => item.fn !== index && item.with !== index).map(item => ({ ...item, fn: shift(item.fn), with: item.with === undefined ? undefined : shift(item.with) }));
                  setSpec({
                    functions: spec.functions.filter((_, i) => i !== index),
                    points,
                    areas: keptAreas.length > 0 ? keptAreas : undefined,
                    tangents: keptTangents.length > 0 ? keptTangents : undefined,
                    secants: keptSecants.length > 0 ? keptSecants : undefined,
                    notable: keptNotable.length > 0 ? keptNotable : undefined,
                  });
                  setExpanded(new Set());
                  bump();
                }}
              />
            </div>
            {open && (
              <div className="crt-form__row crt-form__row--sub">
                <Field label="Desde x =">
                  <OptionalNumberInput
                    label={`Inicio del dominio de la función ${index + 1}`}
                    placeholder="−∞"
                    value={fn.from}
                    onChange={from => setFunction(index, from === undefined ? { from, fromEnd: undefined } : { from })}
                  />
                </Field>
                {fn.from !== undefined && (
                  <Field label="Extremo izquierdo">
                    <OptionSelect className="crt-input" aria-label={`Extremo izquierdo de la función ${index + 1}`} value={fn.fromEnd ?? "closed"} onValueChange={fromEnd => setFunction(index, { fromEnd })} options={END_OPTIONS} />
                  </Field>
                )}
                <Field label="Hasta x =">
                  <OptionalNumberInput
                    label={`Final del dominio de la función ${index + 1}`}
                    placeholder="∞"
                    value={fn.to}
                    onChange={to => setFunction(index, to === undefined ? { to, toEnd: undefined } : { to })}
                  />
                </Field>
                {fn.to !== undefined && (
                  <Field label="Extremo derecho">
                    <OptionSelect className="crt-input" aria-label={`Extremo derecho de la función ${index + 1}`} value={fn.toEnd ?? "closed"} onValueChange={toEnd => setFunction(index, { toEnd })} options={END_OPTIONS} />
                  </Field>
                )}
                <Field label="Trazo">
                  <OptionSelect
                    className="crt-input"
                    aria-label={`Trazo de la función ${index + 1}`}
                    value={fn.style ?? "solid"}
                    onValueChange={style => setFunction(index, { style: style === "solid" ? undefined : style })}
                    options={STROKE_OPTIONS}
                  />
                </Field>
                <Field label="Color">
                  <OptionSelect<number | "">
                    className="crt-input"
                    aria-label={`Color de la función ${index + 1}`}
                    value={fn.color ?? ""}
                    onValueChange={color => setFunction(index, { color: color === "" ? undefined : color })}
                    options={COLOR_OPTIONS}
                  />
                </Field>
              </div>
            )}
          </div>
        );
      })}
      {spec.functions.length < CREATOR_LIMITS.functionsMax && <AddButton onClick={() => setSpec({ functions: [...spec.functions, { expr: "x" }] })}>Añadir función</AddButton>}
      <p className="crt-form__hint">
        La parte entera se escribe floor(x). Para una función a trozos, añade una función por trozo, cada una con su dominio: los trozos que se tocan salen del mismo color y los círculos de los extremos y de los saltos se dibujan solos. Una asíntota horizontal u oblicua es una función con trazo punteado.
      </p>

      {spec.functions.length > 0 && (
        <>
          <span className="crt-form__legend">Puntos notables</span>
          {notable.map((item, index) => {
            const setItem = (patch: Partial<GraphNotable>) => setNotable(notable.map((current, i) => (i === index ? { ...current, ...patch } : current)));
            const others = functionOptions.filter(option => option.value !== item.fn);
            const found = describeNotable(spec, item);
            return (
              <div key={`${listVersion}-n${index}`} className="crt-form__stack">
                <div className="crt-form__row">
                  <Field label={`Puntos ${index + 1}: de`}>
                    <OptionSelect
                      className="crt-input"
                      aria-label={`Función de los puntos notables ${index + 1}`}
                      value={item.fn}
                      onValueChange={fn => setItem({ fn, with: item.with === fn ? functionOptions.find(option => option.value !== fn)?.value : item.with })}
                      options={functionOptions}
                    />
                  </Field>
                  <Field label="Marcar">
                    <OptionSelect
                      className="crt-input"
                      aria-label={`Qué marcar en los puntos notables ${index + 1}`}
                      value={item.kind}
                      onValueChange={kind => setItem({ kind, with: kind === "intersections" ? (item.with ?? others[0]?.value) : undefined })}
                      options={NOTABLE_KIND_OPTIONS.filter(option => option.value !== "intersections" || others.length > 0)}
                    />
                  </Field>
                  {item.kind === "intersections" && others.length > 0 && (
                    <Field label="Con">
                      <OptionSelect className="crt-input" aria-label={`Otra función de los puntos notables ${index + 1}`} value={item.with ?? others[0].value} onValueChange={other => setItem({ with: other })} options={others} />
                    </Field>
                  )}
                  <Check label="Escribir las coordenadas" checked={item.labels !== false} onChange={on => setItem({ labels: on ? undefined : false })} />
                  <RemoveButton
                    label={`Quitar los puntos notables ${index + 1}`}
                    onClick={() => {
                      setNotable(notable.filter((_, i) => i !== index));
                      bump();
                    }}
                  />
                </div>
                {found && <p className="crt-form__hint">{found}</p>}
              </div>
            );
          })}
          {notable.length < CREATOR_LIMITS.notableMax && <AddButton onClick={() => setNotable([...notable, { fn: 0, kind: "roots" }])}>Añadir puntos notables</AddButton>}
          <p className="crt-form__hint">Las raíces, el corte con el eje y, los máximos y mínimos y los cortes entre dos funciones los halla el sistema; no hace falta escribirlos como puntos marcados.</p>

          <span className="crt-form__legend">Regiones sombreadas</span>
          {areas.map((area, index) => {
            const setArea = (patch: Partial<GraphArea>) => setAreas(areas.map((current, i) => (i === index ? { ...current, ...patch } : current)));
            return (
              <div key={`${listVersion}-a${index}`} className="crt-form__group crt-form__stack">
                <div className="crt-form__row">
                  <Field label={`Región ${index + 1}: bajo`}>
                    <OptionSelect className="crt-input" aria-label={`Función de la región ${index + 1}`} value={area.fn} onValueChange={fn => setArea({ fn })} options={functionOptions} />
                  </Field>
                  <Field label="Hasta">
                    <OptionSelect<number | "">
                      className="crt-input"
                      aria-label={`Límite inferior de la región ${index + 1}`}
                      value={area.between ?? ""}
                      onValueChange={between => setArea(between === "" ? { between: undefined } : { between, rectangles: undefined, sample: undefined })}
                      options={[{ value: "", label: "El eje x" }, ...functionOptions.filter(option => option.value !== area.fn)]}
                    />
                  </Field>
                  <Field label="Desde x =">
                    <NumberInput label={`Inicio de la región ${index + 1}`} value={area.from} onChange={from => setArea({ from })} />
                  </Field>
                  <Field label="Hasta x =">
                    <NumberInput label={`Final de la región ${index + 1}`} value={area.to} onChange={to => setArea({ to })} />
                  </Field>
                  <RemoveButton
                    label={`Quitar la región ${index + 1}`}
                    onClick={() => {
                      setAreas(areas.filter((_, i) => i !== index));
                      bump();
                    }}
                  />
                </div>
                <div className="crt-form__row">
                  {area.between === undefined && (
                    <Field label="Rectángulos de Riemann">
                      <OptionalNumberInput
                        label={`Rectángulos de la región ${index + 1}`}
                        placeholder="no"
                        value={area.rectangles}
                        onChange={rectangles => setArea(rectangles === undefined ? { rectangles, sample: undefined } : { rectangles })}
                      />
                    </Field>
                  )}
                  {area.rectangles !== undefined && (
                    <Field label="Altura de cada rectángulo">
                      <OptionSelect
                        className="crt-input"
                        aria-label={`Punto de muestra de la región ${index + 1}`}
                        value={area.sample ?? "left"}
                        onValueChange={sample => setArea({ sample: sample === "left" ? undefined : sample })}
                        options={RIEMANN_SAMPLE_OPTIONS}
                      />
                    </Field>
                  )}
                  <Check label={area.rectangles === undefined ? "Escribir el área" : "Escribir la suma"} checked={area.showValue ?? false} onChange={showValue => setArea({ showValue: showValue || undefined })} />
                </div>
              </div>
            );
          })}
          {areas.length < CREATOR_LIMITS.areasMax && <AddButton onClick={() => setAreas([...areas, { fn: 0, from: 0, to: 1 }])}>Añadir región</AddButton>}

          <span className="crt-form__legend">Tangentes y secantes</span>
          {tangents.map((tangent, index) => {
            const setTangent = (patch: Partial<GraphTangent>) => setTangents(tangents.map((current, i) => (i === index ? { ...current, ...patch } : current)));
            return (
              <div key={`${listVersion}-t${index}`} className="crt-form__row">
                <Field label={`Tangente ${index + 1} a`}>
                  <OptionSelect className="crt-input" aria-label={`Función de la tangente ${index + 1}`} value={tangent.fn} onValueChange={fn => setTangent({ fn })} options={functionOptions} />
                </Field>
                <Field label="En x =">
                  <NumberInput label={`Punto de la tangente ${index + 1}`} value={tangent.x} onChange={x => setTangent({ x })} />
                </Field>
                <Field label="Rótulo">
                  <OptionSelect className="crt-input" aria-label={`Rótulo de la tangente ${index + 1}`} value={tangent.show ?? "none"} onValueChange={show => setTangent({ show: show === "none" ? undefined : show })} options={LINE_SHOW_OPTIONS} />
                </Field>
                <RemoveButton
                  label={`Quitar la tangente ${index + 1}`}
                  onClick={() => {
                    setTangents(tangents.filter((_, i) => i !== index));
                    bump();
                  }}
                />
              </div>
            );
          })}
          {secants.map((secant, index) => {
            const setSecant = (patch: Partial<GraphSecant>) => setSecants(secants.map((current, i) => (i === index ? { ...current, ...patch } : current)));
            return (
              <div key={`${listVersion}-s${index}`} className="crt-form__row">
                <Field label={`Secante ${index + 1} de`}>
                  <OptionSelect className="crt-input" aria-label={`Función de la secante ${index + 1}`} value={secant.fn} onValueChange={fn => setSecant({ fn })} options={functionOptions} />
                </Field>
                <Field label="Entre x =">
                  <NumberInput label={`Primer punto de la secante ${index + 1}`} value={secant.x1} onChange={x1 => setSecant({ x1 })} />
                </Field>
                <Field label="Y x =">
                  <NumberInput label={`Segundo punto de la secante ${index + 1}`} value={secant.x2} onChange={x2 => setSecant({ x2 })} />
                </Field>
                <Field label="Rótulo">
                  <OptionSelect className="crt-input" aria-label={`Rótulo de la secante ${index + 1}`} value={secant.show ?? "none"} onValueChange={show => setSecant({ show: show === "none" ? undefined : show })} options={LINE_SHOW_OPTIONS} />
                </Field>
                <RemoveButton
                  label={`Quitar la secante ${index + 1}`}
                  onClick={() => {
                    setSecants(secants.filter((_, i) => i !== index));
                    bump();
                  }}
                />
              </div>
            );
          })}
          <div className="crt-form__actions">
            {tangents.length < CREATOR_LIMITS.tangentsMax && <AddButton onClick={() => setTangents([...tangents, { fn: 0, x: 1, show: "slope" }])}>Añadir tangente</AddButton>}
            {secants.length < CREATOR_LIMITS.secantsMax && <AddButton onClick={() => setSecants([...secants, { fn: 0, x1: 0, x2: 1, show: "slope" }])}>Añadir secante</AddButton>}
          </div>
          <p className="crt-form__hint">El área, la pendiente de la tangente (la derivada en ese punto) y la de la secante (la razón de cambio promedio) las calcula el sistema.</p>
        </>
      )}

      <span className="crt-form__legend">Geometría: puntos, segmentos y polígonos</span>
      {figures.map((figure, index) => {
        const shown = figure.show ?? [];
        const toggle = (item: FigureShow, on: boolean) => {
          const next = FIGURE_SHOWS[figure.kind].filter(value => (value === item ? on : shown.includes(value)));
          setFigure(index, { ...figure, show: next.length > 0 ? next : undefined });
        };
        const setVertex = (at: number, patch: Partial<GraphFigure["vertices"][number]>) => setFigure(index, { ...figure, vertices: figure.vertices.map((vertex, v) => (v === at ? { ...vertex, ...patch } : vertex)) });
        const removable = figure.vertices.length > FIGURE_MIN_VERTICES[figure.kind];
        return (
          <div key={`${listVersion}-g${index}`} className="crt-form__group crt-form__stack">
            <div className="crt-form__row">
              <Field label={`Figura ${index + 1}`}>
                <OptionSelect
                  className="crt-input"
                  aria-label={`Tipo de la figura ${index + 1}`}
                  value={figure.kind}
                  onValueChange={kind => {
                    setFigure(index, withKind(figure, kind));
                    bump();
                  }}
                  options={FIGURE_KIND_OPTIONS}
                />
              </Field>
              {FIGURE_SHOWS[figure.kind].map(item => (
                <Check key={item} label={FIGURE_SHOW_LABELS[item]} checked={shown.includes(item)} onChange={on => toggle(item, on)} />
              ))}
              <span className="crt-form__end">
                <RemoveButton
                  label={`Quitar la figura ${index + 1}`}
                  onClick={() => {
                    setFigures(figures.filter((_, i) => i !== index));
                    bump();
                  }}
                />
              </span>
            </div>
            {figure.vertices.map((vertex, at) => (
              <div key={at} className="crt-form__item">
                <input
                  className="crt-input crt-input--tiny"
                  aria-label={`Nombre del vértice ${at + 1} de la figura ${index + 1}`}
                  spellCheck={false}
                  maxLength={4}
                  placeholder="A"
                  value={vertex.name ?? ""}
                  onChange={event => setVertex(at, { name: vertexNameOf(event.target.value) })}
                />
                <NumberInput label={`x del vértice ${at + 1} de la figura ${index + 1}`} value={vertex.x} onChange={x => setVertex(at, { x })} />
                <NumberInput label={`y del vértice ${at + 1} de la figura ${index + 1}`} value={vertex.y} onChange={y => setVertex(at, { y })} />
                {removable && (
                  <RemoveButton
                    label={`Quitar el vértice ${at + 1} de la figura ${index + 1}`}
                    onClick={() => {
                      setFigure(index, { ...figure, vertices: figure.vertices.filter((_, v) => v !== at) });
                      bump();
                    }}
                  />
                )}
              </div>
            ))}
            {figure.kind !== "segment" && figure.vertices.length < CREATOR_LIMITS.planeVerticesMax && (
              <AddButton onClick={() => setFigure(index, { ...figure, vertices: [...figure.vertices, nextVertex(figure.vertices)] })}>{figure.kind === "polygon" ? "Añadir vértice" : "Añadir punto"}</AddButton>
            )}
            <div key={`${figure.transform?.kind}-${figure.transform?.kind === "reflection" ? figure.transform.over : ""}`} className="crt-form__row">
              <Field label="Transformación">
                <OptionSelect<TransformKind | "">
                  className="crt-input"
                  aria-label={`Transformación de la figura ${index + 1}`}
                  value={figure.transform?.kind ?? ""}
                  onValueChange={kind => setFigure(index, { ...figure, transform: kind === "" ? undefined : transformTemplate(kind) })}
                  options={TRANSFORM_OPTIONS}
                />
              </Field>
              {figure.transform && <TransformFields transform={figure.transform} index={index} onChange={transform => setFigure(index, { ...figure, transform })} />}
            </div>
            <p className="crt-form__hint">{describeFigure(figure).replace(/\$/g, "")}</p>
          </div>
        );
      })}
      {figures.length < CREATOR_LIMITS.planeFiguresMax && (
        <div className="crt-form__actions">
          {FIGURE_KIND_OPTIONS.map(option => (
            <AddButton key={option.value} onClick={() => setFigures([...figures, figureTemplate(option.value)])}>
              Añadir {FIGURE_KIND_LABELS[option.value].toLowerCase()}
            </AddButton>
          ))}
        </div>
      )}
      {figures.length > 0 && <p className="crt-form__hint">Las longitudes, el punto medio, el perímetro, el área y la imagen por la transformación (A′, B′, C′) los calcula el sistema. Con figuras, deja el plano más o menos cuadrado para que las distancias y los ángulos no se deformen.</p>}

      <span className="crt-form__legend">Inecuaciones con dos variables</span>
      {inequalities.map((inequality, index) => {
        const setInequality = (patch: Partial<GraphInequality>) => setInequalities(inequalities.map((current, i) => (i === index ? { ...current, ...patch } : current)));
        return (
          <div key={`${listVersion}-i${index}`} className="crt-form__item">
            <NumberInput label={`Coeficiente de x de la inecuación ${index + 1}`} value={inequality.a} onChange={a => setInequality({ a })} />
            <span className="crt-form__sign">x +</span>
            <NumberInput label={`Coeficiente de y de la inecuación ${index + 1}`} value={inequality.b} onChange={b => setInequality({ b })} />
            <span className="crt-form__sign">y</span>
            <OptionSelect className="crt-input crt-input--tiny" aria-label={`Signo de la inecuación ${index + 1}`} value={inequality.op} onValueChange={op => setInequality({ op })} options={INEQUALITY_OP_OPTIONS} />
            <NumberInput label={`Término independiente de la inecuación ${index + 1}`} value={inequality.c} onChange={c => setInequality({ c })} />
            <Check label="Escribirla" checked={inequality.label ?? false} onChange={on => setInequality({ label: on || undefined })} />
            <RemoveButton
              label={`Quitar la inecuación ${index + 1}`}
              onClick={() => {
                setInequalities(inequalities.filter((_, i) => i !== index));
                bump();
              }}
            />
          </div>
        );
      })}
      {inequalities.length < CREATOR_LIMITS.inequalitiesMax && <AddButton onClick={() => setInequalities([...inequalities, { a: 1, b: 1, op: "<=", c: 4 }])}>Añadir inecuación</AddButton>}
      {inequalities.length > 0 && (
        <>
          <div className="crt-form__row">
            <Field label="Sombrear">
              <OptionSelect
                className="crt-input"
                aria-label="Qué región de las inecuaciones se sombrea"
                value={spec.inequalityShade ?? "common"}
                onValueChange={shade => setSpec({ inequalityShade: shade === "common" ? undefined : shade })}
                options={REGION_SHADE_OPTIONS}
              />
            </Field>
            <Check label="Marcar los vértices de la región común" checked={spec.inequalityVertices ?? false} onChange={on => setSpec({ inequalityVertices: on || undefined })} />
          </div>
          {regionFacts && <p className="crt-form__hint">{regionFacts}</p>}
          <p className="crt-form__hint">Cada inecuación es a·x + b·y ≤ c: para x ≥ 0 escribe 1, 0, ≥ y 0. La frontera sale continua con ≤ o ≥ y punteada con &lt; o &gt;; la región común y sus vértices los calcula el sistema.</p>
        </>
      )}

      <span className="crt-form__legend">Cónicas</span>
      {conics.map((conic, index) => {
        const shown = conic.show ?? [];
        const toggle = (item: ConicShow, on: boolean) => {
          const next = CONIC_SHOWS[conic.kind].filter(value => (value === item ? on : shown.includes(value)));
          setConic(index, { ...conic, show: next.length > 0 ? next : undefined });
        };
        const equation = conicEquation(conic);
        return (
          <div key={`${listVersion}-c${index}-${conic.kind}`} className="crt-form__group crt-form__stack">
            <div className="crt-form__row">
              <Field label={`Cónica ${index + 1}`}>
                <OptionSelect
                  className="crt-input"
                  aria-label={`Tipo de la cónica ${index + 1}`}
                  value={conic.kind}
                  onValueChange={kind => {
                    setConic(index, conicTemplate(kind, conic.h, conic.k));
                    bump();
                  }}
                  options={CONIC_KIND_OPTIONS}
                />
              </Field>
              <ConicFields conic={conic} index={index} onChange={next => setConic(index, next)} />
            </div>
            <div className="crt-form__row">
              {CONIC_SHOWS[conic.kind].map(item => (
                <Check key={item} label={CONIC_SHOW_LABELS[item]} checked={shown.includes(item)} onChange={on => toggle(item, on)} />
              ))}
              <span className="crt-form__end">
                <RemoveButton
                  label={`Quitar la cónica ${index + 1}`}
                  onClick={() => {
                    setConics(conics.filter((_, i) => i !== index));
                    bump();
                  }}
                />
              </span>
            </div>
            {equation && (
              <p className="crt-form__hint">
                Ecuación: <Formula latex={equation} />
              </p>
            )}
          </div>
        );
      })}
      {conics.length < CREATOR_LIMITS.conicsMax && <AddButton onClick={() => setConics([...conics, conicTemplate("circle")])}>Añadir cónica</AddButton>}
      {conics.length > 0 && <p className="crt-form__hint">El centro, los focos, los vértices, la directriz, las asíntotas y la ecuación se calculan solos. Con cónicas, deja el plano más o menos cuadrado: así tiene la misma unidad en los dos ejes y una circunferencia se ve redonda.</p>}

      <span className="crt-form__legend">Rectas verticales</span>
      {verticalLines.map((line, index) => {
        const setLine = (patch: Partial<GraphVerticalLine>) => setVerticalLines(verticalLines.map((current, i) => (i === index ? { ...current, ...patch } : current)));
        return (
          <div key={`${listVersion}-v${index}`} className="crt-form__item">
            <NumberInput label={`x de la recta vertical ${index + 1}`} value={line.x} onChange={x => setLine({ x })} />
            <input
              className="crt-input crt-input--code"
              aria-label={`Etiqueta de la recta vertical ${index + 1} en LaTeX`}
              spellCheck={false}
              placeholder="x = 2"
              value={line.label ?? ""}
              onChange={event => setLine({ label: event.target.value || undefined })}
            />
            <OptionSelect
              className="crt-input"
              aria-label={`Trazo de la recta vertical ${index + 1}`}
              value={line.style ?? "solid"}
              onValueChange={style => setLine({ style: style === "solid" ? undefined : style })}
              options={STROKE_OPTIONS}
            />
            <RemoveButton
              label={`Quitar la recta vertical ${index + 1}`}
              onClick={() => {
                setVerticalLines(verticalLines.filter((_, i) => i !== index));
                bump();
              }}
            />
          </div>
        );
      })}
      {verticalLines.length < CREATOR_LIMITS.verticalLinesMax && <AddButton onClick={() => setVerticalLines([...verticalLines, { x: 0, style: "dashed" }])}>Añadir recta vertical</AddButton>}

      <span className="crt-form__legend">Puntos marcados</span>
      {spec.points.map((point, index) => {
        const setPoint = (patch: Partial<typeof point>) => setSpec({ points: spec.points.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
        return (
          <div key={`${listVersion}-p${index}`} className="crt-form__item">
            <NumberInput label={`x del punto ${index + 1}`} value={point.x} onChange={x => setPoint({ x })} />
            <NumberInput label={`y del punto ${index + 1}`} value={point.y} onChange={y => setPoint({ y })} />
            <input className="crt-input crt-input--code" aria-label={`Etiqueta del punto ${index + 1} en LaTeX`} spellCheck={false} placeholder="(0, -3)" value={point.label ?? ""} onChange={event => setPoint({ label: event.target.value || undefined })} />
            <OptionSelect<number | "">
              className="crt-input"
              aria-label={`Función del punto ${index + 1}`}
              value={point.on ?? ""}
              onValueChange={on => setPoint({ on: on === "" ? null : on })}
              options={[{ value: "", label: "Punto libre" }, ...spec.functions.map((_, i) => ({ value: i, label: `Sobre ${functionName(i)}` }))]}
            />
            <Check label="Vacío" checked={point.open ?? false} onChange={open => setPoint({ open: open || undefined })} />
            <RemoveButton
              label={`Quitar el punto ${index + 1}`}
              onClick={() => {
                setSpec({ points: spec.points.filter((_, i) => i !== index) });
                bump();
              }}
            />
          </div>
        );
      })}
      {spec.points.length < CREATOR_LIMITS.pointsMax && <AddButton onClick={() => setSpec({ points: [...spec.points, { x: 0, y: 0, on: null }] })}>Añadir punto</AddButton>}

      <div className="crt-form__row">
        <Field label="Pie de la gráfica (opcional)" wide>
          <input className="crt-input" value={draft.caption ?? ""} onChange={event => onChange({ ...draft, caption: event.target.value || undefined })} />
        </Field>
      </div>
    </>
  );
}
