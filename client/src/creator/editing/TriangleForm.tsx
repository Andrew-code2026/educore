import { Fragment } from "react";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import type { BlockInput } from "@shared/creator";
import { measureText } from "@shared/creatorExact";
import { ANGLE_KEYS, angleMeasure, SIDE_KEYS, solveTriangle, TRIANGLE_LABEL_MAX, type TriangleData, type TriangleShow } from "@shared/creatorTriangle";
import { AddButton, RemoveButton, useListVersion } from "./FigureForms";
import { CaptionField, Check, Field, OptionalNumberInput, type FormProps } from "./fields";

type TriangleSpec = Extract<BlockInput, { type: "triangle" }>;

/** Contenido inicial del triángulo al añadirlo desde «Añadir bloque»: un ejercicio de Pitágoras. */
export const TRIANGLE_TEMPLATE: TriangleSpec = {
  type: "triangle",
  triangles: [{ vertices: ["A", "B", "C"], sides: { a: { length: 6 }, b: { length: 8 }, c: { label: "x", show: "label" } }, angles: { C: { degrees: 90 } } }],
  unit: "cm",
  markRight: true,
};

const SECOND_TRIANGLE: TriangleData = { vertices: ["D", "E", "F"], sides: { a: { length: 9 }, b: { length: 12 }, c: { length: 15 } }, angles: {} };

const SHOW_OPTIONS: readonly SelectOption<TriangleShow | "auto">[] = [
  { value: "auto", label: "Auto" },
  { value: "value", label: "Medida" },
  { value: "label", label: "Rótulo" },
  { value: "both", label: "Los dos" },
  { value: "none", label: "Nada" },
];

type Part = { length?: number; degrees?: number; show?: TriangleShow; label?: string };

/** Un lado o un ángulo sin campos vacíos: lo que no se dijo no se guarda. */
function cleanPart(part: Part): Part | undefined {
  const entries = Object.entries(part).filter(([, value]) => value !== undefined && value !== "");
  return entries.length > 0 ? (Object.fromEntries(entries) as Part) : undefined;
}

/** Cómo se llama un vértice en el formulario: su nombre en la figura, o su letra si no lo tiene. */
const vertexName = (data: TriangleData, i: number) => data.vertices[i] || ANGLE_KEYS[i];
/** Un lado por sus extremos, como en la figura: el lado a es BC. */
const sideName = (data: TriangleData, i: number) => `${vertexName(data, (i + 1) % 3)}${vertexName(data, (i + 2) % 3)}`;

/** Lo que el sistema calcula con los datos escritos, o por qué no puede. */
function solvedHint(solution: ReturnType<typeof solveTriangle>, data: TriangleData, unit: string | undefined): string {
  if (!solution.ok) return solution.issues[0].replace(/^./, char => char.toUpperCase());
  const { sides, angles, given } = solution.triangle;
  const parts = [
    ...sides.flatMap((value, i) => (given.sides[i] ? [] : [`${sideName(data, i)} ${measureText(value)}${unit ? ` ${unit}` : ""}`])),
    ...angles.flatMap((value, i) => (given.angles[i] ? [] : [`ángulo ${vertexName(data, i)} ${angleMeasure(value)}`])),
  ];
  return parts.length > 0 ? `El sistema calcula: ${parts.join(", ")}.` : "Todos los datos están escritos; el sistema comprueba que coincidan.";
}

function TriangleFields({ data, index, unit, onChange }: { data: TriangleData; index: number; unit: string | undefined; onChange: (next: TriangleData) => void }) {
  const solution = solveTriangle(data);
  const row = (kind: "side" | "angle", key: string, i: number, title: string) => {
    const part: Part = (kind === "side" ? data.sides[key as (typeof SIDE_KEYS)[number]] : data.angles[key as (typeof ANGLE_KEYS)[number]]) ?? {};
    const set = (patch: Part) => {
      const next = cleanPart({ ...part, ...patch });
      onChange(kind === "side" ? { ...data, sides: { ...data.sides, [key]: next } } : { ...data, angles: { ...data.angles, [key]: next } });
    };
    // Un campo vacío muestra lo que calculará el sistema
    const computed = solution.ok ? (kind === "side" ? measureText(solution.triangle.sides[i]) : angleMeasure(solution.triangle.angles[i])) : "calcular";
    const name = `${title} del triángulo ${index + 1}`;
    return (
      <Fragment key={key}>
        <span className="crt-form__datagrid-name">{title}</span>
        <OptionalNumberInput label={kind === "side" ? `Longitud del ${name}` : `Grados del ${name}`} placeholder={computed} value={kind === "side" ? part.length : part.degrees} onChange={value => set(kind === "side" ? { length: value } : { degrees: value })} />
        <OptionSelect className="crt-input" aria-label={`Qué se escribe en el ${name}`} value={part.show ?? "auto"} onValueChange={show => set({ show: show === "auto" ? undefined : show })} options={SHOW_OPTIONS} />
        <input className="crt-input" aria-label={`Rótulo del ${name}`} maxLength={TRIANGLE_LABEL_MAX} value={part.label ?? ""} onChange={event => set({ label: event.target.value || undefined })} />
      </Fragment>
    );
  };
  return (
    <>
      <div className="crt-form__row">
        {data.vertices.map((name, i) => (
          <Field key={i} label={`Vértice ${ANGLE_KEYS[i]}`}>
            <input
              className="crt-input crt-input--tiny"
              maxLength={3}
              value={name}
              onChange={event => onChange({ ...data, vertices: data.vertices.map((current, j) => (j === i ? event.target.value : current)) })}
            />
          </Field>
        ))}
      </div>
      <div className="crt-form__datagrid crt-form__datagrid--triangle">
        <span />
        <span className="crt-field__label">Dato</span>
        <span className="crt-field__label">Se escribe</span>
        <span className="crt-field__label">Rótulo</span>
        {SIDE_KEYS.map((key, i) => row("side", key, i, `Lado ${sideName(data, i)}`))}
        {ANGLE_KEYS.map((key, i) => row("angle", key, i, `Ángulo ${vertexName(data, i)}`))}
      </div>
      <p className="crt-form__hint">{solvedHint(solution, data, unit)}</p>
    </>
  );
}

export function TriangleForm({ draft, onChange }: FormProps<"triangle">) {
  const [version, bump] = useListVersion();
  const setTriangle = (index: number, next: TriangleData) => onChange({ ...draft, triangles: draft.triangles.map((current, i) => (i === index ? next : current)) });
  return (
    <>
      {draft.triangles.map((data, index) => (
        <div key={`${version}-${index}`} className="crt-form__group">
          {draft.triangles.length > 1 && (
            <div className="crt-form__row">
              <strong>Triángulo {index + 1}</strong>
              <RemoveButton
                label={`Quitar el triángulo ${index + 1}`}
                onClick={() => {
                  onChange({ ...draft, triangles: draft.triangles.filter((_, i) => i !== index) });
                  bump();
                }}
              />
            </div>
          )}
          <TriangleFields data={data} index={index} unit={draft.unit} onChange={next => setTriangle(index, next)} />
        </div>
      ))}
      <div className="crt-form__row">
        <Field label="Unidad">
          <input className="crt-input crt-input--tiny" maxLength={6} value={draft.unit ?? ""} placeholder="cm" onChange={event => onChange({ ...draft, unit: event.target.value || undefined })} />
        </Field>
        <Check label="Marcar el ángulo recto" checked={draft.markRight} onChange={markRight => onChange({ ...draft, markRight })} />
        {draft.triangles.length < 2 && (
          <AddButton
            onClick={() => {
              onChange({ ...draft, triangles: [...draft.triangles, SECOND_TRIANGLE] });
              bump();
            }}
          >
            Añadir otro triángulo (semejanza)
          </AddButton>
        )}
      </div>
      <p className="crt-form__hint">
        Escribe los datos que determinan el triángulo (tres lados, dos lados y el ángulo entre ellos, o un lado y dos ángulos) y deja en blanco lo demás: el sistema lo calcula y lo muestra en gris. Los rótulos son texto plano: x, θ, ?.
        «Auto» escribe la medida de los datos, el rótulo si lo hay, y nada en lo que se calcula.
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
    </>
  );
}
