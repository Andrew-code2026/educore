import type { CSSProperties, ReactNode } from "react";
import { Formula } from "./Formula";
import { RichText } from "./RichText";

/** Rótulo colocado sobre la figura. Va en HTML (no en el SVG) para poder dibujar fórmulas con KaTeX. */
export interface FigureLabel {
  /** Posición en las unidades del viewBox. */
  x: number;
  y: number;
  /** Qué punto del rótulo cae en (x, y). "top" = el rótulo queda debajo del punto. */
  anchor?: "center" | "top" | "bottom" | "left" | "right";
  latex?: string;
  /** Markdown en línea, para rótulos con unidades como "5 cm". */
  md?: string;
  tone?: "point" | "a" | "b" | "c" | "d" | "muted";
}

interface FigureFrameProps {
  width: number;
  height: number;
  /** Descripción para lectores de pantalla. */
  description: string;
  labels?: FigureLabel[];
  children: ReactNode;
}

/** Colores de relleno y trazo por índice, compartidos por todas las figuras. */
export const FIGURE_COLORS = [
  { stroke: "#1F5FE0", fill: "#CFE0FF" },
  { stroke: "#C2410C", fill: "#FBD5C5" },
  { stroke: "#0F8A5F", fill: "#C5EBD9" },
  { stroke: "#7A3FD1", fill: "#E2D5FA" },
  { stroke: "#A16207", fill: "#F5E3B8" },
  { stroke: "#0E7C86", fill: "#C4E9EC" },
  { stroke: "#C2327A", fill: "#F8D0E3" },
  { stroke: "#5D656E", fill: "#DDE2E7" },
] as const;

export const figureColor = (index: number) => FIGURE_COLORS[index % FIGURE_COLORS.length];

/** Alto que ocupa el título de una figura, o el margen superior si no lo lleva. */
export const figureTitleHeight = (title: string | undefined) => (title ? 30 : 8);

/** Título centrado sobre la figura. */
export function FigureTitle({ text, width }: { text: string | undefined; width: number }) {
  if (!text) return null;
  return (
    <text x={width / 2} y={20} textAnchor="middle" className="crt-figure__title">
      {text}
    </text>
  );
}

/** Halo blanco bajo un texto que cae sobre la cuadrícula o una línea: sigue legible en papel. */
export const TEXT_HALO = { paintOrder: "stroke", stroke: "#FFFFFF", strokeWidth: 3, strokeLinejoin: "round" } as const;

/**
 * Marco común de las figuras: un SVG que se adapta al ancho disponible y rótulos HTML
 * colocados en porcentaje, de modo que la figura se ve igual en pantalla y en papel.
 */
export function FigureFrame({ width, height, description, labels = [], children }: FigureFrameProps) {
  return (
    <div className="crt-figure" style={{ "--fig-w": `${width}px`, aspectRatio: `${width} / ${height}` } as CSSProperties}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
        {children}
      </svg>
      {labels.map((label, index) => (
        <span
          key={index}
          className={`crt-figure__label crt-figure__label--${label.anchor ?? "center"}${label.tone ? ` crt-figure__label--tone-${label.tone}` : ""}`}
          style={{ left: `${(label.x / width) * 100}%`, top: `${(label.y / height) * 100}%` }}
        >
          {/* \displaystyle: en un rótulo suelto las fracciones van a tamaño completo, o no se leen en papel */}
          {label.latex !== undefined ? <Formula latex={`\\displaystyle ${label.latex}`} /> : <RichText md={label.md ?? ""} inline />}
        </span>
      ))}
    </div>
  );
}
