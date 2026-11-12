import { memo, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface FormulaProps {
  latex: string;
  /** Fórmula destacada en su propia línea. */
  display?: boolean;
  className?: string;
}

/** Fórmula LaTeX dibujada con KaTeX. Si el LaTeX no compila se muestra el texto, nunca rompe la página. */
export const Formula = memo(function Formula({ latex, display = false, className }: FormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: "ignore", output: "htmlAndMathml" });
    } catch {
      return null;
    }
  }, [latex, display]);

  if (html === null) {
    return (
      <code className={className} title="Fórmula no válida">
        {latex}
      </code>
    );
  }
  const Tag = display ? "div" : "span";
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
