import { Fragment, type ReactNode } from "react";
import { isPiarFieldVisible, piarFullName, piarSchema, type PiarField, type PiarValues } from "@shared/piar";

interface PiarPrintSheetProps {
  values: PiarValues;
  schoolName: string;
  group: string;
  finalizedAt: Date | null;
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
};

/** Valor legible de un campo para el documento impreso. */
function printedValue(field: PiarField, values: PiarValues): string {
  if (field.type === "linked") return field.get?.(values) ?? "";
  const value = field.key ? values[field.key] ?? "" : "";
  if (field.type === "date" && value) return formatDate(value);
  return value;
}

/** Los tres anexos como documento, para imprimir o guardar en PDF. */
export function PiarPrintSheet({ values, schoolName, group, finalizedAt }: PiarPrintSheetProps) {
  const annexes = piarSchema(values);
  const name = piarFullName(values) || "Estudiante";

  return (
    <article className="pia-doc">
      {annexes.map((annex, annexIndex) => (
        <section key={annex.title} className="pia-doc__annex">
          <header className="pia-doc__head">
            <span className="pia-doc__kicker">
              {schoolName} · PIAR · Decreto 1421 de 2017
            </span>
            <h1 className="pia-doc__title">
              {annex.title}. {annex.subtitle}
            </h1>
            <p className="pia-doc__meta">
              {name} · Curso {group}
              {annexIndex === 0 && finalizedAt ? ` · Finalizado el ${finalizedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </p>
          </header>

          {annex.sections.map(section => (
            <section key={section.title} className="pia-doc__section">
              <h2 className="pia-doc__section-title">
                <span>{section.eyebrow}</span> {section.title}
              </h2>
              {section.subs ? (
                section.subs.map(sub => (
                  <div key={sub.label} className="pia-doc__fields">
                    <PrintedFields fields={sub.fields} values={values} />
                  </div>
                ))
              ) : (
                <div className="pia-doc__fields">
                  <PrintedFields fields={section.fields ?? []} values={values} />
                </div>
              )}
            </section>
          ))}
        </section>
      ))}
    </article>
  );
}

function PrintedFields({ fields, values }: { fields: PiarField[]; values: PiarValues }) {
  return (
    <>
      {fields.filter(field => isPiarFieldVisible(field, values)).map((field, index) => (
        <Fragment key={`${field.key ?? field.label}-${index}`}>{printedField(field, values)}</Fragment>
      ))}
    </>
  );
}

function printedField(field: PiarField, values: PiarValues): ReactNode {
  switch (field.type) {
    case "heading":
      return (
        <h3 className="pia-doc__heading">
          {field.label}
          {field.hint && <span> · {field.hint}</span>}
        </h3>
      );
    case "notice":
      return <p className="pia-doc__notice">{field.label}</p>;
    case "action":
      return null;
    case "sig": {
      const value = printedValue(field, values);
      return (
        <div className="pia-doc__sig">
          <span className="pia-doc__line" />
          <span className="pia-doc__label">{field.label}</span>
          {value && <span className="pia-doc__stamp">Firma registrada · {value}</span>}
        </div>
      );
    }
    case "textarea":
    case "dim": {
      const value = printedValue(field, values);
      return (
        <div className="pia-doc__block">
          <span className="pia-doc__label">{field.label}</span>
          <p className="pia-doc__text">{value || "—"}</p>
        </div>
      );
    }
    default: {
      const value = printedValue(field, values);
      return (
        <div className="pia-doc__row" style={{ gridColumn: `span ${field.span}` }}>
          <span className="pia-doc__label">{field.label}</span>
          <span className="pia-doc__value">{value || "—"}</span>
        </div>
      );
    }
  }
}
