import { OptionSelect, type SelectOption } from "@/components/option-select";
import type { BlockInput } from "@shared/creator";
import { describeUnitCircle, isNotableAngle, UNIT_CIRCLE_LABEL_MAX, type UnitCircleSet } from "@shared/creatorUnitCircle";
import { CaptionField, Check, Field, NumberInput, type Draft, type FormProps } from "./fields";

type UnitCircleSpec = Extract<BlockInput, { type: "unit_circle" }>;

/** Contenido inicial del círculo unitario al añadirlo desde «Añadir bloque»: el de referencia, completo. */
export const UNIT_CIRCLE_TEMPLATE: UnitCircleSpec = { type: "unit_circle", unit: "degrees", angles: "all", showAngles: true, showCoordinates: true };

const UNIT_OPTIONS: readonly SelectOption<Draft<"unit_circle">["unit"]>[] = [
  { value: "degrees", label: "Grados (150°)" },
  { value: "radians", label: "Radianes (5π/6)" },
];

const SET_OPTIONS: readonly SelectOption<UnitCircleSet>[] = [
  { value: "all", label: "Los 16 notables" },
  { value: "first_quadrant", label: "Primer cuadrante" },
  { value: "axes", label: "Solo los ejes" },
];

const NEW_HIGHLIGHT = { degrees: 150, label: "θ", values: true };

export function UnitCircleForm({ draft, onChange }: FormProps<"unit_circle">) {
  const highlight = draft.highlight;
  const setHighlight = (patch: Partial<NonNullable<typeof highlight>>) => highlight && onChange({ ...draft, highlight: { ...highlight, ...patch } });
  // Lo que calcula el sistema del ángulo resaltado, sin el prefijo con que se lo devuelve a la IA
  const facts = highlight && isNotableAngle(highlight.degrees) ? describeUnitCircle({ ...draft, showAngles: true, showCoordinates: true })?.replace(/^Círculo unitario: /, "") : null;
  return (
    <>
      <div className="crt-form__row">
        <Field label="Ángulos en">
          <OptionSelect className="crt-input" value={draft.unit} onValueChange={unit => onChange({ ...draft, unit })} options={UNIT_OPTIONS} />
        </Field>
        <Field label="Puntos marcados">
          <OptionSelect className="crt-input" value={draft.angles} onValueChange={angles => onChange({ ...draft, angles })} options={SET_OPTIONS} />
        </Field>
      </div>
      <div className="crt-form__row">
        <Check label="Escribir los ángulos" checked={draft.showAngles} onChange={showAngles => onChange({ ...draft, showAngles })} />
        <Check label="Escribir las coordenadas" checked={draft.showCoordinates} onChange={showCoordinates => onChange({ ...draft, showCoordinates })} />
      </div>
      <div className="crt-form__group">
        <div className="crt-form__row">
          <Check label="Resaltar un ángulo" checked={Boolean(highlight)} onChange={on => onChange({ ...draft, highlight: on ? NEW_HIGHLIGHT : undefined })} />
        </div>
        {highlight && (
          <>
            <div className="crt-form__row">
              <Field label="Ángulo, en grados">
                <NumberInput label="Ángulo resaltado, en grados" value={highlight.degrees} onChange={degrees => setHighlight({ degrees })} />
              </Field>
              <Field label="Nombre">
                <input className="crt-input crt-input--tiny" maxLength={UNIT_CIRCLE_LABEL_MAX} value={highlight.label ?? ""} placeholder="θ" onChange={event => setHighlight({ label: event.target.value || undefined })} />
              </Field>
            </div>
            <div className="crt-form__row">
              <Check label="Triángulo de referencia" checked={highlight.triangle !== false} onChange={triangle => setHighlight({ triangle: triangle ? undefined : false })} />
              <Check label="Escribir sus valores" checked={highlight.values} onChange={values => setHighlight({ values })} />
            </div>
            <p className="crt-form__hint">{facts ?? "Usa un ángulo notable: múltiplo de 30° o de 45°, entre -360° y 360°."}</p>
          </>
        )}
      </div>
      <p className="crt-form__hint">Las coordenadas (cos, sen) las escribe el sistema, exactas. Para que el estudiante las complete, quita «Escribir las coordenadas»; en la clave, deja el mismo círculo completo.</p>
      <CaptionField value={draft.caption} onChange={caption => onChange({ ...draft, caption })} />
    </>
  );
}
