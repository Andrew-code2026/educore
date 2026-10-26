import { memo } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PiarField, PiarSource, PiarValues } from "@shared/piar";

export interface PiarFieldViewProps {
  field: PiarField;
  /** Valor propio del campo (vacío si no tiene clave). */
  value: string;
  /** Todos los valores: los campos vinculados se calculan con ellos. */
  values: PiarValues;
  /** Prefijo de ids para asociar etiquetas y controles. */
  idPrefix: string;
  /** Primer elemento visible de la grilla: el encabezado no lleva línea superior. */
  first: boolean;
  guideOpen: boolean;
  onChange: (key: string, value: string) => void;
  onToggleGuide: (key: string) => void;
  onGoToSource: (source: PiarSource) => void;
  onAddActivity: () => void;
  onRemoveActivity: () => void;
}

/** Fecha y hora con que se registra una firma, como en el resto de la plataforma. */
export const signatureStamp = (now = new Date()) => now.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

/** Un campo del formulario del PIAR, según su tipo. */
export const PiarFieldView = memo(function PiarFieldView({
  field,
  value,
  values,
  idPrefix,
  first,
  guideOpen,
  onChange,
  onToggleGuide,
  onGoToSource,
  onAddActivity,
  onRemoveActivity,
}: PiarFieldViewProps) {
  const id = `${idPrefix}-${field.key ?? field.label}`;
  const set = (next: string) => field.key && onChange(field.key, next);

  switch (field.type) {
    case "heading":
      return (
        <div className={cn("pia-heading", !first && "pia-heading--rule")}>
          <div>
            <h3 className="pia-heading__title">{field.label}</h3>
            {field.hint && <p className="pia-heading__hint">{field.hint}</p>}
          </div>
          {field.removable && (
            <button type="button" className="pia-btn pia-btn--ghost pia-btn--danger" onClick={onRemoveActivity}>
              Quitar
            </button>
          )}
        </div>
      );

    case "text":
    case "date":
    case "number":
      return (
        <>
          <label htmlFor={id} className="pia-label">
            {field.label}
          </label>
          <input
            id={id}
            type={field.type}
            className="pia-input"
            value={value}
            placeholder={field.placeholder}
            min={field.type === "number" ? 0 : undefined}
            autoComplete="off"
            onChange={event => set(event.target.value)}
          />
        </>
      );

    case "select":
      return (
        <>
          <label htmlFor={id} className="pia-label">
            {field.label}
          </label>
          <select id={id} className="pia-select" value={value} onChange={event => set(event.target.value)}>
            <option value="">Seleccione…</option>
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      );

    case "radio":
      return (
        <>
          <span id={id} className="pia-label">
            {field.label}
          </span>
          <div role="group" aria-labelledby={id} className="pia-options">
            {field.options?.map(option => {
              const on = value === option;
              return (
                <button key={option} type="button" aria-pressed={on} className="pia-option" onClick={() => set(on ? "" : option)}>
                  {option}
                </button>
              );
            })}
          </div>
        </>
      );

    case "textarea":
      return (
        <>
          <label htmlFor={id} className="pia-label">
            {field.label}
          </label>
          {field.hint && (
            <p id={`${id}-hint`} className="pia-hint">
              {field.hint}
            </p>
          )}
          <textarea
            id={id}
            className="pia-textarea"
            rows={field.rows ?? 3}
            value={value}
            placeholder={field.placeholder}
            aria-describedby={field.hint ? `${id}-hint` : undefined}
            onChange={event => set(event.target.value)}
          />
        </>
      );

    case "dim":
      return (
        <div className="pia-dim">
          <span className="pia-eyebrow">Dimensión</span>
          <h3 className="pia-dim__title">{field.label}</h3>
          <p id={`${id}-guide`} className={cn("pia-dim__guide", !guideOpen && "pia-dim__guide--clamped")}>
            {field.guide}
          </p>
          <button type="button" className="pia-link-btn" aria-expanded={guideOpen} aria-controls={`${id}-guide`} onClick={() => field.key && onToggleGuide(field.key)}>
            {guideOpen ? "Ocultar orientación" : "Ver orientación completa"}
          </button>
          <textarea
            id={id}
            className="pia-textarea"
            rows={5}
            value={value}
            placeholder="Descripción"
            aria-label={`Descripción: ${field.label}`}
            onChange={event => set(event.target.value)}
          />
        </div>
      );

    case "notice":
      return <p className="pia-notice">{field.label}</p>;

    case "linked": {
      const linked = field.get?.(values) ?? "";
      return (
        <>
          <span id={id} className="pia-label">
            {field.label}
          </span>
          <div aria-labelledby={id} className={cn("pia-linked", !linked && "pia-linked--empty")}>
            {linked || "Pendiente de diligenciar"}
          </div>
          {field.source ? (
            <button type="button" className="pia-source" onClick={() => onGoToSource(field.source!)}>
              {field.source.label} ↗
            </button>
          ) : (
            <span className="pia-source">Calculado automáticamente</span>
          )}
        </>
      );
    }

    case "sig":
      return (
        <>
          <span id={id} className="pia-label">
            {field.label}
          </span>
          <div aria-labelledby={id} className={cn("pia-sig", value && "pia-sig--signed")}>
            <span className="pia-sig__text">
              {value ? (
                <>
                  <CheckCircle2 aria-hidden="true" strokeWidth={2} />
                  Firma registrada · {value}
                </>
              ) : (
                "Sin firma registrada"
              )}
            </span>
            <button type="button" className="pia-btn pia-btn--outline" onClick={() => set(value ? "" : signatureStamp())}>
              {value ? "Quitar firma" : "Registrar firma"}
            </button>
          </div>
        </>
      );

    case "action":
      return (
        <button type="button" className="pia-add" onClick={onAddActivity}>
          <Plus aria-hidden="true" strokeWidth={2} />
          {field.label}
        </button>
      );
  }
});
