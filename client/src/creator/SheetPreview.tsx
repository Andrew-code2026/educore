export type SheetKind = "plot" | "reading";

/** Renglones de texto de la miniatura: [y, ancho]. */
const READING_LINES: Array<[number, number]> = [
  [46, 104],
  [54, 97],
  [62, 104],
  [70, 88],
  [78, 101],
  [86, 60],
];

const QUESTION_LINES: Array<[number, number]> = [
  [130, 78],
  [141, 64],
  [152, 72],
];

/**
 * Miniatura dibujada de una hoja como las que produce el Creador: asoma en las tarjetas anchas
 * de ideas para mostrar qué se obtiene. Es decorativa y, como la hoja real, siempre es papel blanco.
 */
export function SheetPreview({ kind }: { kind: SheetKind }) {
  return (
    <span aria-hidden="true" className="crt-sheet">
      <span className="crt-sheet__page crt-sheet__page--back" />
      <svg className="crt-sheet__page" viewBox="0 0 132 172" focusable="false">
        <rect className="crt-sheet__paper" width="132" height="172" rx="7" />
        <rect className="crt-sheet__ink" x="14" y="15" width="62" height="5.5" rx="2.75" opacity=".86" />
        <rect className="crt-sheet__ink" x="14" y="25.5" width="38" height="3" rx="1.5" opacity=".3" />
        <rect className="crt-sheet__ink" x="14" y="35" width="104" height=".75" opacity=".14" />

        {kind === "plot" ? (
          <>
            {/* Plano cartesiano con una recta y una parábola */}
            <g className="crt-sheet__rule">
              {[27, 40, 53, 66, 79, 92, 105].map(x => (
                <line key={x} x1={x} y1="44" x2={x} y2="109" />
              ))}
              {[57, 70, 83, 96].map(y => (
                <line key={y} x1="14" y1={y} x2="118" y2={y} />
              ))}
            </g>
            <rect className="crt-sheet__frame" x="14" y="44" width="104" height="65" rx="3" />
            <path className="crt-sheet__axis" d="M53 46.5V106.5M16.5 83H115.5" />
            <path className="crt-sheet__curve crt-sheet__curve--b" d="M56.5 47Q79.5 145 102.5 47" />
            <path className="crt-sheet__curve" d="M22 105.5L88 47.5" />
            <circle className="crt-sheet__dot" cx="53" cy="78.2" r="2.1" />
            <circle className="crt-sheet__dot crt-sheet__dot--b" cx="79.5" cy="96" r="2.1" />
            {QUESTION_LINES.map(([y, width], index) => (
              <g key={y} transform="translate(0 -9)">
                <circle className="crt-sheet__num" cx="17.5" cy={y + 1.5} r="3.2" />
                <rect className="crt-sheet__ink" x="25" y={y} width={width + index * 4} height="3" rx="1.5" opacity=".24" />
              </g>
            ))}
            <path className="crt-sheet__answer" d="M25 157.5H118" />
          </>
        ) : (
          <>
            {/* Lectura: un párrafo, una cita destacada y preguntas */}
            {READING_LINES.map(([y, width]) => (
              <rect key={y} className="crt-sheet__ink" x="14" y={y} width={width} height="3" rx="1.5" opacity=".22" />
            ))}
            <rect className="crt-sheet__callout" x="14" y="98" width="104" height="22" rx="4" />
            <rect className="crt-sheet__bar" x="14" y="98" width="3" height="22" rx="1.5" />
            <rect className="crt-sheet__ink" x="23" y="104.5" width="82" height="3" rx="1.5" opacity=".34" />
            <rect className="crt-sheet__ink" x="23" y="111.5" width="54" height="3" rx="1.5" opacity=".34" />
            {QUESTION_LINES.map(([y, width]) => (
              <g key={y}>
                <circle className="crt-sheet__num" cx="17.5" cy={y + 1.5} r="3.2" />
                <rect className="crt-sheet__ink" x="25" y={y} width={width} height="3" rx="1.5" opacity=".24" />
              </g>
            ))}
          </>
        )}
      </svg>
    </span>
  );
}
