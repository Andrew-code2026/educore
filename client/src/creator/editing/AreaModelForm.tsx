import type { BlockInput } from "@shared/creator";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { areaModelProduct, computeAreaModel, polynomialText, splitTerms } from "@shared/creatorAlgebra";
import { Formula } from "../blocks/Formula";
import { CaptionField, Check, Field, type Draft, type FormProps } from "./fields";

/** Contenido inicial del modelo de área al añadirlo desde «Añadir bloque». */
export const AREA_MODEL_TEMPLATE: Extract<BlockInput, { type: "area_model" }> = { type: "area_model", rows: ["x", "3"], columns: ["x", "2"], hide: "none", showTotal: true };

/** Términos por lado que admite el esquema del bloque. */
const SIDE_TERMS_MAX = 3;

const HIDE_OPTIONS: readonly SelectOption<Draft<"area_model">["hide"]>[] = [
  { value: "none", label: "Nada: se muestra todo" },
  { value: "cells", label: "Las celdas (multiplica)" },
  { value: "dimensions", label: "Los lados (factoriza)" },
];

/** Los términos de un lado como los escribe el docente: "x + 3", "2x - 5". */
const sideText = (terms: string[]) => terms.map((term, index) => (index === 0 ? term : term.startsWith("-") ? `- ${term.slice(1)}` : `+ ${term}`)).join(" ");

export function AreaModelForm({ draft, onChange }: FormProps<"area_model">) {
  const model = computeAreaModel(draft.rows, draft.columns);
  // El esquema rechaza un cuarto término con un mensaje genérico: aquí se dice en claro
  const tooMany = draft.rows.length > SIDE_TERMS_MAX || draft.columns.length > SIDE_TERMS_MAX;
  return (
    <>
      <div className="crt-form__row">
        <Field label="Lado horizontal (ancho)" wide>
          <input className="crt-input crt-input--code" spellCheck={false} placeholder="x + 2" defaultValue={sideText(draft.columns)} onChange={event => onChange({ ...draft, columns: splitTerms(event.target.value) })} />
        </Field>
        <Field label="Lado vertical (alto)" wide>
          <input className="crt-input crt-input--code" spellCheck={false} placeholder="x + 3" defaultValue={sideText(draft.rows)} onChange={event => onChange({ ...draft, rows: splitTerms(event.target.value) })} />
        </Field>
      </div>
      <div className="crt-form__row">
        <Field label="Qué completa el estudiante">
          <OptionSelect className="crt-input" value={draft.hide} onValueChange={hide => onChange({ ...draft, hide })} options={HIDE_OPTIONS} />
        </Field>
        <Check label="Escribir el área total" checked={draft.showTotal} onChange={showTotal => onChange({ ...draft, showTotal })} />
      </div>
      <p className="crt-form__hint">
        Escribe cada lado como una suma: x + 3, 2x - 5 o, para multiplicar números, 20 + 3. Hasta tres términos por lado y una sola letra; los miles van sin punto (1000) y los decimales con coma (0,5). Las celdas y el total se calculan solos
        {model && !tooMany ? (
          <>
            : <Formula latex={`${areaModelProduct(model, "latex")} = ${polynomialText(model.total, "latex")}`} />.
          </>
        ) : (
          "."
        )}
      </p>
      {tooMany && (
        <p className="crt-form__hint" role="alert">
          Hay más de tres términos en un lado: el modelo admite hasta tres.
        </p>
      )}
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
    </>
  );
}
