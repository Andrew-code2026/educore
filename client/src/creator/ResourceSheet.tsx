import { Fragment, type ReactNode } from "react";
import type { Block, ResourceDoc, Section } from "@shared/creator";
import { BlockView } from "./blocks/BlockView";

interface ResourceSheetProps {
  doc: ResourceDoc;
  schoolName?: string;
  logoUrl?: string | null;
  /** Envuelve cada bloque: en pantalla añade los controles de edición; al imprimir no se usa. */
  renderBlock?: (block: Block, section: Section) => ReactNode;
  /** Encabezado de cada sección en pantalla (título editable y sus controles). Sin esto, el título como texto desde la segunda. */
  renderSectionTitle?: (section: Section, index: number) => ReactNode;
  /** Contenido extra al final de cada sección (p. ej. el botón para añadir bloques). */
  renderSectionEnd?: (section: Section) => ReactNode;
  /** Encabezado editable; si no se pasa, se muestra el título como texto. */
  renderTitle?: () => ReactNode;
}

/**
 * La hoja del recurso: membrete, título y secciones. Es la misma en la pantalla del
 * editor y en la copia que se imprime, así lo que el docente ve es lo que sale en papel.
 */
export function ResourceSheet({ doc, schoolName, logoUrl, renderBlock, renderSectionTitle, renderSectionEnd, renderTitle }: ResourceSheetProps) {
  return (
    <article className="crt-doc">
      {(schoolName || logoUrl) && (
        <div className="crt-doc__school">
          {logoUrl && <img src={logoUrl} alt="" />}
          {schoolName && <span>{schoolName}</span>}
        </div>
      )}

      <header className="crt-doc__head">
        {renderTitle ? (
          renderTitle()
        ) : (
          <>
            <h1 className="crt-doc__title">{doc.title || "Recurso sin título"}</h1>
            {doc.subtitle && <p className="crt-doc__subtitle">{doc.subtitle}</p>}
          </>
        )}
      </header>

      {doc.sections.map((section, index) => (
        <section key={section.id} id={`crt-${section.id}`} className="crt-doc__section" data-role={section.role}>
          {/* La primera sección es la guía misma: su nombre ya lo dice el título del recurso */}
          {renderSectionTitle ? renderSectionTitle(section, index) : index > 0 && <h2 className="crt-doc__section-title">{section.title}</h2>}
          {section.blocks.map(block => (
            <Fragment key={block.id}>
              {renderBlock ? (
                renderBlock(block, section)
              ) : (
                <div className={`crt-block crt-block--${block.type}`}>
                  <BlockView block={block} />
                </div>
              )}
            </Fragment>
          ))}
          {renderSectionEnd?.(section)}
        </section>
      ))}
    </article>
  );
}
