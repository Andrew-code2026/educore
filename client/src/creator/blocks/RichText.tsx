import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkMath from "remark-math";
import { Formula } from "./Formula";

interface RichTextProps {
  md: string;
  /** Sin párrafos: para celdas de tabla, rótulos y texto que va en la misma línea que otro. */
  inline?: boolean;
  className?: string;
}

const REMARK_PLUGINS = [remarkMath];

/** El documento es para imprimir: sin imágenes externas y sin enlaces navegables. */
const DISALLOWED = ["img", "iframe", "script"];

type HastNode = NonNullable<ExtraProps["node"]>;

const classNames = (node: HastNode | undefined): string[] => {
  const value = node?.properties?.className;
  return Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\s+/) : [];
};

const hastText = (node: HastNode["children"][number]): string =>
  node.type === "text" ? node.value : node.type === "element" ? node.children.map(hastText).join("") : "";

/**
 * remark-math deja cada fórmula como `<code class="language-math math-inline|math-display">`.
 * Se dibuja con `Formula`, es decir, con el mismo KaTeX del proyecto que valida el LaTeX y
 * cuya hoja de estilos se carga: una sola versión para el marcado y el CSS. (Con rehype-katex
 * el marcado salía de otra versión y los exponentes quedaban del tamaño de la base.)
 */
const MATH_COMPONENTS: Components = {
  code: ({ node, className, children }) => {
    const classes = classNames(node);
    if (!classes.includes("language-math")) return <code className={className}>{children}</code>;
    return <Formula latex={node ? node.children.map(hastText).join("") : ""} display={classes.includes("math-display")} />;
  },
  // La fórmula en bloque llega envuelta en <pre>; se quita para que no herede su estilo de código
  pre: ({ node, children }) => {
    const only = node?.children.length === 1 ? node.children[0] : undefined;
    if (only?.type === "element" && classNames(only).includes("math-display")) return <>{children}</>;
    return <pre>{children}</pre>;
  },
};

const INLINE_COMPONENTS: Components = {
  ...MATH_COMPONENTS,
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
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} disallowedElements={DISALLOWED} unwrapDisallowed components={inline ? INLINE_COMPONENTS : MATH_COMPONENTS}>
      {inline ? md : isolateDisplayMath(md)}
    </ReactMarkdown>
  );
  if (inline) return <span className={className}>{content}</span>;
  return <div className={className ? `crt-rich ${className}` : "crt-rich"}>{content}</div>;
});
