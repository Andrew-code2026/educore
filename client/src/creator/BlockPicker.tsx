import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Command } from "cmdk";
import {
  Blend,
  Boxes,
  ChartCandlestick,
  ChartColumn,
  ChartColumnBig,
  ChartLine,
  ChartPie,
  ChartScatter,
  ChartSpline,
  Clock,
  Columns2,
  Divide,
  Grid2x2,
  Heading,
  LayoutGrid,
  ListChecks,
  MessageSquareQuote,
  MoveHorizontal,
  Network,
  PencilLine,
  Pilcrow,
  Radius,
  RectangleHorizontal,
  Scale,
  Search,
  SeparatorHorizontal,
  Shapes,
  Sigma,
  Smile,
  Table,
  Table2,
  Triangle,
  TriangleRight,
  UserRound,
} from "lucide-react";
import { BLOCK_TYPE_LABELS, type BlockType } from "@shared/creator";
import { BLOCK_INFO, filterBlockFamilies } from "./structure";

const ICONS: Record<BlockType, ComponentType<{ "aria-hidden"?: boolean }>> = {
  header_fields: UserRound,
  paragraph: Pilcrow,
  heading: Heading,
  callout: MessageSquareQuote,
  math: Sigma,
  exercise: PencilLine,
  solution: ListChecks,
  table: Table,
  value_table: Table2,
  graph: ChartSpline,
  bar_chart: ChartColumn,
  pie_chart: ChartPie,
  line_chart: ChartLine,
  scatter_plot: ChartScatter,
  histogram: ChartColumnBig,
  box_plot: ChartCandlestick,
  pictogram: Smile,
  tree_diagram: Network,
  venn: Blend,
  shapes: Shapes,
  triangle: Triangle,
  unit_circle: Radius,
  angle: TriangleRight,
  clock: Clock,
  number_line: MoveHorizontal,
  fraction_model: Divide,
  bar_model: RectangleHorizontal,
  base_ten: Boxes,
  area_model: Grid2x2,
  balance: Scale,
  page_break: SeparatorHorizontal,
  columns: Columns2,
  cards: LayoutGrid,
};

interface BlockPickerProps {
  /** Qué hace elegir: «Insertar debajo», «Cambiar este texto por…». Va de rótulo del buscador. */
  title: string;
  onPick: (type: BlockType) => void;
  /** Se cerró sin elegir: con Escape, o porque el foco se fue a otra parte. */
  onClose: (reason: "escape" | "blur") => void;
  /** Tipos que no se ofrecen aquí (p. ej. el salto de página en lugar de un texto). */
  exclude?: readonly BlockType[];
}

/**
 * El menú para insertar un bloque: un buscador y los tipos agrupados por familias. Flechas para
 * moverse, Intro para elegir y Escape para cerrar. Lo usan el «+», «Añadir bloque» y la «/».
 */
export function BlockPicker({ title, onPick, onClose, exclude }: BlockPickerProps) {
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const families = useMemo(
    () => filterBlockFamilies(query).flatMap(family => {
      const types = family.types.filter(type => !exclude?.includes(type));
      return types.length > 0 ? [{ ...family, types }] : [];
    }),
    [exclude, query],
  );

  // Que se vea entero aunque se abra al pie de la hoja
  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <div
      ref={root}
      className="crt-picker"
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        // Escape es del menú: no debe cerrar también el bloque que se edita debajo
        event.stopPropagation();
        event.preventDefault();
        onClose("escape");
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose("blur");
      }}
      // Un clic en una opción no se lleva el foco del buscador: el menú no se cierra antes de elegir
      onMouseDown={event => {
        if (!(event.target as HTMLElement).closest("input")) event.preventDefault();
      }}
    >
      <Command shouldFilter={false} loop label={title}>
        <div className="crt-picker__search">
          <Search aria-hidden="true" />
          <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Buscar un bloque…" aria-label={`${title}: buscar un bloque`} />
        </div>
        <Command.List className="crt-picker__list" aria-label={title}>
          <Command.Empty className="crt-picker__empty">Ningún bloque se llama así.</Command.Empty>
          {families.map(family => (
            <Command.Group key={family.id} heading={family.label} className="crt-picker__group">
              {family.types.map(type => {
                const Icon = ICONS[type];
                return (
                  <Command.Item key={type} value={type} className="crt-picker__item" onSelect={() => onPick(type)}>
                    <Icon aria-hidden />
                    <span className="crt-picker__text">
                      <span className="crt-picker__label">{BLOCK_TYPE_LABELS[type]}</span>
                      <span className="crt-picker__hint">{BLOCK_INFO[type]?.hint}</span>
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <p className="crt-picker__foot" aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd> moverse · <kbd>Intro</kbd> insertar · <kbd>Esc</kbd> cerrar
        </p>
      </Command>
    </div>
  );
}
