import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface RichTextProps {
  md: string;
  /** Sin párrafos: para celdas de tabla, rótulos y texto que va en la misma línea que otro. */
  inline?: boolean;
  className?: string;
}

const REMARK_PLUGINS = [remarkMath];
const REHYPE_PLUGINS: [typeof rehypeKatex, { strict: "ignore"; throwOnError: false; errorColor: string }][] = [
  [rehypeKatex, { strict: "ignore", throwOnError: false, errorColor: "#B42343" }],
];

/** El documento es para imprimir: sin imágenes externas y sin enlaces navegables. */
const DISALLOWED = ["img", "iframe", "script"];

const INLINE_COMPONENTS: Components = {
  p: ({ children }: { children?: ReactNode }) => <>{children}</>,
};

/**
 * `$$...$$` solo es una fórmula en bloque si va en sus propias líneas; el modelo suele
 * escribirlo seguido del texto. Se separa para que se centre como en un libro.
 */
function isolateDisplayMath(md: string): string {
  return md.replace(/\$\$([\s\S]+?)\$\$/g, (_match, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`);
}

/** Texto en Markdown con fórmulas LaTeX (`$...$` en línea, `$$...$$` en bloque). */
export const RichText = memo(function RichText({ md, inline = false, className }: RichTextProps) {
  const content = (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      disallowedElements={DISALLOWED}
      unwrapDisallowed
      components={inline ? INLINE_COMPONENTS : undefined}
    >
      {inline ? md : isolateDisplayMath(md)}
    </ReactMarkdown>
  );
  if (inline) return <span className={className}>{content}</span>;
  return <div className={className ? `crt-rich ${className}` : "crt-rich"}>{content}</div>;
});
