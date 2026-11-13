import type { BlockInput } from "@shared/creator";
import { areaModelProduct, computeAreaModel, polynomialText, splitTerms } from "@shared/creatorAlgebra";
import { Formula } from "../blocks/Formula";
import { BlockPreview, CaptionField, Check, Field, type FormProps } from "./fields";

/** Contenido inicial del modelo de área al añadirlo desde «Añadir bloque». */
export const AREA_MODEL_TEMPLATE: Extract<BlockInput, { type: "area_model" }> = { type: "area_model", rows: ["x", "3"], columns: ["x", "2"], hide: "none", showTotal: true };

/** Los términos de un lado como los escribe el docente: "x + 3", "2x - 5". */
const sideText = (terms: string[]) => terms.map((term, index) => (index === 0 ? term : term.startsWith("-") ? `- ${term.slice(1)}` : `+ ${term}`)).join(" ");

export function AreaModelForm({ draft, onChange }: FormProps<"area_model">) {
  const model = computeAreaModel(draft.rows, draft.columns);
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
          <select className="crt-input" value={draft.hide} onChange={event => onChange({ ...draft, hide: event.target.value as typeof draft.hide })}>
            <option value="none">Nada: se muestra todo</option>
            <option value="cells">Las celdas (multiplica)</option>
            <option value="dimensions">Los lados (factoriza)</option>
          </select>
        </Field>
        <Check label="Escribir el área total" checked={draft.showTotal} onChange={showTotal => onChange({ ...draft, showTotal })} />
      </div>
      <p className="crt-form__hint">
        Escribe cada lado como una suma: x + 3, 2x - 5 o, para multiplicar números, 20 + 3. Hasta tres términos por lado y una sola letra. Las celdas y el total se calculan solos
        {model ? (
          <>
            : <Formula latex={`${areaModelProduct(model, "latex")} = ${polynomialText(model.total, "latex")}`} />.
          </>
        ) : (
          "."
        )}
      </p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
      <BlockPreview draft={draft} />
    </>
  );
}
