import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Aire entre lo que queda pegado arriba y lo que se ve debajo (la barra de formato, la sección a la que se salta). */
const GAP = 12;

/**
 * Lo que se queda pegado arriba de la hoja al desplazarla (el selector de secciones, el resumen del
 * turno de la IA). Le dice a la hoja cuánto ocupa (`--crt-sticky-top`) para que lo que se trae a la
 * vista quede debajo y no tapado, aunque el resumen parta renglón.
 */
export function StageTop({ children }: { children: ReactNode }) {
  const top = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = top.current;
    const stage = element?.parentElement;
    if (!element || !stage) return;
    const measure = () => stage.style.setProperty("--crt-sticky-top", `${element.offsetHeight + GAP}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      stage.style.removeProperty("--crt-sticky-top");
    };
  }, []);

  return (
    <div className="crt-stage__top" ref={top}>
      {children}
    </div>
  );
}

interface SectionJumperProps {
  sections: { id: string; title: string }[];
}

const sectionElement = (id: string) => document.getElementById(`crt-${id}`);

/**
 * Para ir de una sección del recurso a otra: un botón con el nombre de la que se está viendo y,
 * al abrirlo, la lista de todas. La actual sigue al desplazamiento de la hoja.
 */
export function SectionJumper({ sections }: SectionJumperProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  // Mientras dura el desplazamiento suave de un salto, la elegida manda (si no, el botón recorre las de en medio)
  const jumping = useRef<number | null>(null);

  const locate = useCallback(() => {
    const stage = trigger.current?.closest<HTMLElement>(".crt-stage");
    if (!stage || jumping.current !== null) return;
    const sticky = parseFloat(getComputedStyle(stage).getPropertyValue("--crt-sticky-top")) || 0;
    const line = stage.getBoundingClientRect().top + sticky + 24;
    let found: string | null = null;
    for (const section of sections) {
      const element = sectionElement(section.id);
      if (element && element.getBoundingClientRect().top <= line) found = section.id;
    }
    // Al fondo de la hoja la última sección puede no llegar arriba: si ya no hay más que bajar, es ella
    if (stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2 && sections.length > 0) found = sections[sections.length - 1].id;
    setCurrentId(found ?? sections[0]?.id ?? null);
  }, [sections]);
  // Los oyentes de la hoja se ponen una vez y leen siempre la versión al día: `sections` cambia con cada edición
  const locateRef = useRef(locate);
  useLayoutEffect(() => {
    locateRef.current = locate;
    locate();
  }, [locate]);

  /** La sección a la que se está saltando: el salto termina al llegar a ella. */
  const target = useRef<string | null>(null);

  /**
   * Suelta el salto a los `ms` sin desplazamiento: es el respaldo para cuando no hubo que desplazar o
   * el navegador no avisa con `scrollend`. Va holgado porque un equipo lento deja huecos entre cuadros.
   */
  const holdJump = useCallback((ms: number) => {
    if (jumping.current !== null) window.clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => {
      jumping.current = null;
      target.current = null;
      locateRef.current();
    }, ms);
  }, []);

  useEffect(() => {
    const stage = trigger.current?.closest<HTMLElement>(".crt-stage");
    if (!stage) return;
    let frame = 0;
    const arrived = () => {
      const element = target.current ? sectionElement(target.current) : null;
      if (!element) return true;
      const goal = stage.getBoundingClientRect().top + (parseFloat(getComputedStyle(element).scrollMarginTop) || 0);
      const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;
      return Math.abs(element.getBoundingClientRect().top - goal) <= 2 || atBottom;
    };
    const onScroll = () => {
      if (jumping.current !== null) {
        holdJump(arrived() ? 0 : 1000);
        return;
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        locateRef.current();
      });
    };
    // Al terminar el desplazamiento, o si el docente toma la hoja a mano a mitad del salto, manda otra vez la posición
    const settle = () => {
      if (jumping.current !== null) holdJump(0);
    };
    const takeover = ["scrollend", "wheel", "touchstart", "pointerdown"] as const;
    stage.addEventListener("scroll", onScroll, { passive: true });
    for (const type of takeover) stage.addEventListener(type, settle, { passive: true });
    return () => {
      stage.removeEventListener("scroll", onScroll);
      for (const type of takeover) stage.removeEventListener(type, settle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [holdJump]);

  useEffect(
    () => () => {
      if (jumping.current !== null) window.clearTimeout(jumping.current);
    },
    [],
  );

  const jump = (id: string) => {
    const element = sectionElement(id);
    if (!element) return;
    setCurrentId(id);
    target.current = id;
    holdJump(1000);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  };

  // El salto espera a que el menú se cierre: al devolver el foco al botón, el navegador cortaría el desplazamiento suave
  const pending = useRef<string | null>(null);
  // Quien eligió con el puntero no necesita el anillo de foco en el botón; quien usa el teclado, sí
  const byPointer = useRef(false);
  const onCloseAutoFocus = (event: Event) => {
    const id = pending.current;
    pending.current = null;
    if (!id) return;
    event.preventDefault();
    // `focusVisible` aún no está en los tipos del DOM de TypeScript; el navegador que no lo conoce lo ignora
    const options: FocusOptions & { focusVisible?: boolean } = { preventScroll: true, focusVisible: !byPointer.current };
    trigger.current?.focus(options);
    jump(id);
  };

  const current = sections.find(section => section.id === currentId) ?? sections[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* El nombre accesible empieza por el texto visible (quien navega por voz dice lo que ve) */}
        <button ref={trigger} type="button" className="crt-jump">
          <ListTree aria-hidden="true" />
          <span className="crt-jump__title">{current.title}</span>
          <span className="sr-only">: ir a otra sección</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={onCloseAutoFocus}
        onPointerDown={() => {
          byPointer.current = true;
        }}
        onKeyDown={() => {
          byPointer.current = false;
        }}
        className="crt-menu data-[state=closed]:animate-none min-w-(--radix-dropdown-menu-trigger-width) max-w-[min(360px,calc(100vw-24px))] max-h-[min(60vh,var(--radix-dropdown-menu-content-available-height))]">
        {sections.map(section => {
          const active = section.id === current.id;
          return (
            <DropdownMenuItem
              key={section.id}
              aria-current={active ? "location" : undefined}
              className={cn("py-2", active && "bg-accent/70 font-semibold")}
              onSelect={() => {
                pending.current = section.id;
              }}
            >
              <span className="truncate">{section.title}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
