import { Fragment } from "react";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import type { BlockInput } from "@shared/creator";
import { describeSolids, NET_KINDS, netOf, SOLID_KINDS, SOLID_LABEL_MAX, SOLID_NAMES, solidMeasures, type NetMode, type Solid, type SolidKind } from "@shared/creatorSolids";
import { AddButton, RemoveButton, useListVersion } from "./FigureForms";
import { CaptionField, Check, Field, NumberInput, type FormProps } from "./fields";

type SolidSpec = Extract<BlockInput, { type: "solid" }>;

/** Un sólido de cada clase con medidas de aula, para cuando el docente cambia la clase. */
const SOLID_TEMPLATES: Record<SolidKind, Solid> = {
  cube: { kind: "cube", edge: 4 },
  rectangular_prism: { kind: "rectangular_prism", length: 8, width: 3, height: 5 },
  triangular_prism: { kind: "triangular_prism", base: 6, triangleHeight: 4, length: 10, triangle: "isosceles" },
  cylinder: { kind: "cylinder", radius: 3, height: 5 },
  cone: { kind: "cone", radius: 3, height: 4, slant: false },
  square_pyramid: { kind: "square_pyramid", base: 6, height: 4, slant: false },
  sphere: { kind: "sphere", radius: 3 },
};

/** Contenido inicial del bloque al añadirlo desde «Añadir bloque»: un cilindro con sus medidas. */
export const SOLID_TEMPLATE: SolidSpec = { type: "solid", solids: [SOLID_TEMPLATES.cylinder], unit: "cm", showValues: true, toScale: false };

const KIND_OPTIONS: readonly SelectOption<SolidKind>[] = SOLID_KINDS.map(kind => ({ value: kind, label: `${SOLID_NAMES[kind][0].toUpperCase()}${SOLID_NAMES[kind].slice(1)}` }));

const TRIANGLE_OPTIONS: readonly SelectOption<"isosceles" | "right">[] = [
  { value: "isosceles", label: "Isósceles" },
  { value: "right", label: "Rectángulo" },
];

const NET_OPTIONS: readonly SelectOption<NetMode | "none">[] = [
  { value: "none", label: "No" },
  { value: "beside", label: "Junto al sólido" },
  { value: "only", label: "Solo el desarrollo" },
];

function SolidFields({ solid, index, onChange }: { solid: Solid; index: number; onChange: (next: Solid) => void }) {
  const measures = solidMeasures(solid).filter(measure => !measure.derived);
  const set = (key: string, value: unknown) => onChange({ ...solid, [key]: value } as Solid);
  return (
    <>
      <div className="crt-form__datagrid crt-form__datagrid--solid">
        <span />
        <span className="crt-field__label">Medida</span>
        <span className="crt-field__label">Ver</span>
        <span className="crt-field__label">Rótulo</span>
        {measures.map(measure => (
          <Fragment key={measure.key}>
            <span className="crt-form__datagrid-name">{measure.name[0].toUpperCase() + measure.name.slice(1)}</span>
            <NumberInput label={`${measure.name} del sólido ${index + 1}`} value={measure.value} onChange={value => set(measure.key, value)} />
            {/* Un rótulo vacío deja esa medida sin escribir en la figura */}
            <input type="checkbox" aria-label={`Escribir ${measure.name} del sólido ${index + 1}`} checked={measure.label !== ""} onChange={event => set(`${measure.key}Label`, event.target.checked ? undefined : "")} />
            <input
              className="crt-input"
              aria-label={`Rótulo de ${measure.name} del sólido ${index + 1}`}
              maxLength={SOLID_LABEL_MAX}
              disabled={measure.label === ""}
              value={measure.label ?? ""}
              onChange={event => set(`${measure.key}Label`, event.target.value || undefined)}
            />
          </Fragment>
        ))}
      </div>
      {(solid.kind === "cone" || solid.kind === "square_pyramid") && (
        <div className="crt-form__row">
          <Check label={solid.kind === "cone" ? "Dibujar la generatriz" : "Dibujar la apotema"} checked={solid.slant} onChange={slant => onChange({ ...solid, slant })} />
          {solid.slant && (
            <Field label="Rótulo">
              <input className="crt-input crt-input--tiny" maxLength={SOLID_LABEL_MAX} value={solid.slantLabel ?? ""} onChange={event => onChange({ ...solid, slantLabel: event.target.value || undefined })} />
            </Field>
          )}
        </div>
      )}
      {(solid.kind === "triangular_prism" || NET_KINDS.includes(solid.kind)) && (
        <div className="crt-form__row">
          {solid.kind === "triangular_prism" && (
            <Field label="Triángulo">
              <OptionSelect className="crt-input" value={solid.triangle} onValueChange={triangle => onChange({ ...solid, triangle })} options={TRIANGLE_OPTIONS} />
            </Field>
          )}
          {NET_KINDS.includes(solid.kind) && (
            <Field label="Desarrollo plano">
              <OptionSelect className="crt-input" value={netOf(solid) ?? "none"} onValueChange={net => set("net", net === "none" ? undefined : net)} options={NET_OPTIONS} />
            </Field>
          )}
        </div>
      )}
    </>
  );
}

export function SolidForm({ draft, onChange }: FormProps<"solid">) {
  const [version, bump] = useListVersion();
  const setSolid = (index: number, next: Solid) => onChange({ ...draft, solids: draft.solids.map((current, i) => (i === index ? next : current)) });
  // Lo que calcula el sistema, sin el prefijo con que se lo devuelve a la IA
  const facts = describeSolids(draft).replace(/^Sólidos: /, "");
  return (
    <>
      {draft.solids.map((solid, index) => (
        <div key={`${version}-${index}-${solid.kind}`} className="crt-form__group">
          <div className="crt-form__row">
            <Field label={`Sólido ${index + 1}`}>
              <OptionSelect
                className="crt-input"
                value={solid.kind}
                onValueChange={kind => {
                  setSolid(index, SOLID_TEMPLATES[kind]);
                  bump();
                }}
                options={KIND_OPTIONS}
              />
            </Field>
            {draft.solids.length > 1 && (
              <RemoveButton
                label={`Quitar el sólido ${index + 1}`}
                onClick={() => {
                  onChange({ ...draft, solids: draft.solids.filter((_, i) => i !== index) });
                  bump();
                }}
              />
            )}
          </div>
          <SolidFields solid={solid} index={index} onChange={next => setSolid(index, next)} />
        </div>
      ))}
      <div className="crt-form__row">
        <Field label="Unidad">
          <input className="crt-input crt-input--tiny" maxLength={6} value={draft.unit ?? ""} placeholder="cm" onChange={event => onChange({ ...draft, unit: event.target.value || undefined })} />
        </Field>
        <Check label="Escribir las medidas" checked={draft.showValues} onChange={showValues => onChange({ ...draft, showValues })} />
        {draft.solids.length > 1 && <Check label="Todos a la misma escala" checked={draft.toScale} onChange={toScale => onChange({ ...draft, toScale })} />}
        {draft.solids.length < 3 && (
          <AddButton
            onClick={() => {
              onChange({ ...draft, solids: [...draft.solids, SOLID_TEMPLATES.cone] });
              bump();
            }}
          >
            Añadir sólido
          </AddButton>
        )}
      </div>
      <p className="crt-form__hint">{facts}</p>
      <p className="crt-form__hint">
        Un rótulo (h, x, ?) reemplaza a la medida en la figura; escribe uno para la medida que el estudiante debe hallar. El volumen y el área los calcula el sistema.
        {draft.solids.some(solid => solid.kind === "cylinder" && netOf(solid)) && " En el desarrollo del cilindro, el largo del rectángulo sigue al radio: 6π con el valor, 2πr con una letra, y nada si el radio no se escribe."}
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
    </>
  );
}
