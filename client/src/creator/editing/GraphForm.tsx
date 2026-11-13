import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { CREATOR_LIMITS, graphSpecSchema, type GraphFunction, type GraphVerticalLine } from "@shared/creator";
import type { EndStyle } from "@shared/creatorPlane";
import { CoordinatePlane } from "../blocks/CoordinatePlane";
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

/** ¿La función usa alguna de las opciones que el formulario guarda plegadas? */
const hasOptions = (fn: GraphFunction) => fn.from !== undefined || fn.to !== undefined || fn.color !== undefined || fn.style !== undefined;

export function GraphForm({ draft, onChange }: FormProps<"graph">) {
  const [listVersion, bump] = useListVersion();
  // Funciones con las opciones de dominio y color a la vista
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const spec = draft.spec;
  const setSpec = (patch: Partial<typeof spec>) => onChange({ ...draft, spec: { ...spec, ...patch } });
  const preview = graphSpecSchema.safeParse(spec);
  const setFunction = (index: number, patch: Partial<GraphFunction>) => setSpec({ functions: spec.functions.map((current, i) => (i === index ? { ...current, ...patch } : current)) });
  const functionName = (index: number) => spec.functions[index]?.expr || `función ${index + 1}`;
  const verticalLines = spec.verticalLines ?? [];
  // Una lista que queda vacía se quita del bloque: así un plano sin rectas se guarda como antes
  const setVerticalLines = (next: GraphVerticalLine[]) => setSpec({ verticalLines: next.length > 0 ? next : undefined });

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
                  const points = spec.points.map(point => (point.on == null ? point : point.on === index ? { ...point, on: null } : point.on > index ? { ...point, on: point.on - 1 } : point));
                  setSpec({ functions: spec.functions.filter((_, i) => i !== index), points });
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
        La parte entera se escribe floor(x). Para una función a trozos, añade una función por trozo, cada una con su dominio y todas con el mismo color; los círculos de los extremos y de los saltos se dibujan solos. Una asíntota horizontal u oblicua es una función con trazo punteado.
      </p>

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

      <Field label="Pie de la gráfica (opcional)" wide>
        <input className="crt-input" value={draft.caption ?? ""} onChange={event => onChange({ ...draft, caption: event.target.value || undefined })} />
      </Field>
      <div className="crt-form__preview">{preview.success ? <CoordinatePlane spec={preview.data} /> : <span className="crt-muted">Completa los rangos para ver la gráfica.</span>}</div>
    </>
  );
}
