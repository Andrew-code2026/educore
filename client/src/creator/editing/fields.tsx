import type { ReactNode } from "react";
import { blockInputSchema, type Block, type BlockInput, type BlockType } from "@shared/creator";
import { BlockView } from "../blocks/BlockView";

export type Draft<T extends BlockType> = Extract<BlockInput, { type: T }>;
export type FormProps<T extends BlockType> = { draft: Draft<T>; onChange: (next: Draft<T>) => void };

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "crt-field crt-field--wide" : "crt-field"}>
      <span className="crt-field__label">{label}</span>
      {children}
    </label>
  );
}

/** Número sin controlar: permite escribir "-" o "1." a medias sin que el campo se borre. */
export function NumberInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      className="crt-input crt-input--num"
      type="number"
      step="any"
      aria-label={label}
      defaultValue={Number.isFinite(value) ? value : ""}
      onChange={event => onChange(event.target.valueAsNumber)}
    />
  );
}

/** Igual que NumberInput, pero vacío significa "que lo calcule el sistema". */
export function OptionalNumberInput({ value, onChange, label }: { value: number | undefined; onChange: (value: number | undefined) => void; label: string }) {
  return (
    <input
      className="crt-input crt-input--num"
      type="number"
      step="any"
      aria-label={label}
      placeholder="auto"
      defaultValue={value ?? ""}
      onChange={event => onChange(Number.isNaN(event.target.valueAsNumber) ? undefined : event.target.valueAsNumber)}
    />
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="crt-check">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** Pie opcional, común a todas las figuras. */
export function CaptionField({ value, onChange }: { value: string | undefined; onChange: (value: string | undefined) => void }) {
  // Dentro de un renglón: el campo "ancho" crece a lo ancho; suelto en la columna crecería a lo alto
  return (
    <div className="crt-form__row">
      <Field label="Pie de la figura (opcional)" wide>
        <input className="crt-input" value={value ?? ""} onChange={event => onChange(event.target.value || undefined)} />
      </Field>
    </div>
  );
}

/** Vista previa de lo que se está editando, con el mismo dibujo que tendrá en la hoja. */
export function BlockPreview({ draft }: { draft: BlockInput }) {
  const parsed = blockInputSchema.safeParse(draft);
  return (
    <div className="crt-form__preview">
      {parsed.success ? <BlockView block={{ ...parsed.data, id: "preview" } as Block} /> : <span className="crt-muted">Completa los datos para ver la figura.</span>}
    </div>
  );
}
