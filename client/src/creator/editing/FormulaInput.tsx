import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { Keyboard } from "lucide-react";
import { checkLatex } from "@shared/creatorValidate";
import { Formula } from "../blocks/Formula";
import { fieldResult, fitsField, hasEmptySlot } from "./formulaLatex";
import { loadedMathKit, loadMathKit, mountMathField, type MathKit } from "./mathField";

interface FormulaInputProps {
  /** LaTeX inicial. El campo no se vuelve a cargar si cambia: móntalo con una `key` distinta. */
  value: string;
  /** Recibe el LaTeX que se guardaría, cada vez que cambia. */
  onChange: (latex: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Fórmula destacada: campo más alto y varias líneas de LaTeX en el modo avanzado. */
  display?: boolean;
  /** Dibuja debajo cómo queda la fórmula mientras se escribe en LaTeX. */
  preview?: boolean;
}

/** En una pantalla táctil no hay teclado físico con el que escribir la fórmula. */
const isTouch = () => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Donde se escribe una fórmula. Por defecto es un campo matemático: se teclea `3/4` o `x^2` y se
 * ve la fórmula ya formada, con un teclado en pantalla opcional. El modo avanzado deja ver y editar
 * el LaTeX, que es lo que se guarda. Una fórmula que el campo no sabe representar se abre en LaTeX
 * y no se altera.
 */
export function FormulaInput({ value, onChange, onEnter, onEscape, autoFocus, display, preview }: FormulaInputProps) {
  const id = useId();
  const [kit, setKit] = useState<MathKit | null>(loadedMathKit);
  const [failed, setFailed] = useState(false);
  const [latexMode, setLatexMode] = useState(false);
  /** El campo no puede con la fórmula actual: solo se edita en LaTeX. */
  const [unfit, setUnfit] = useState(false);
  const [text, setText] = useState(value);
  const [emptySlot, setEmptySlot] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const root = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLSpanElement>(null);
  const keyboardHost = useRef<HTMLSpanElement>(null);
  const latexInput = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  /** La fórmula tal como entró al campo y lo que el campo devolvió al recibirla. */
  const loaded = useRef({ original: value, readBack: "" });
  const latest = useRef({ text, onChange, onEnter, onEscape });
  latest.current = { text, onChange, onEnter, onEscape };

  useEffect(() => {
    if (kit) return;
    let alive = true;
    // Mientras llega la librería el foco espera aquí: lo que se teclee no debe caer en el texto de la hoja
    if (autoFocus) host.current?.focus({ preventScroll: true });
    void loadMathKit().then(ready => {
      if (!alive) return;
      if (ready) setKit(ready);
      else {
        setFailed(true);
        setLatexMode(true);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [kit]);

  /** Pone una fórmula en el campo y dice si el campo la representa sin estropearla. */
  const load = useCallback((target: MathfieldElement, latex: string) => {
    target.setValue(latex, { silenceNotifications: true, mode: "math" });
    const readBack = target.getValue("latex-expanded");
    loaded.current = { original: latex, readBack };
    setEmptySlot(false);
    return fitsField(latex, readBack, target.errors.length);
  }, []);

  const showKeyboard = useCallback(
    (show: boolean) => {
      if (!kit) return;
      if (show) {
        kit.keyboard.container = keyboardHost.current;
        kit.keyboard.show({ animate: false });
      } else kit.keyboard.hide({ animate: false });
      setKeyboardOpen(show);
    },
    [kit],
  );

  // El campo se crea una vez, cuando la librería está lista
  useEffect(() => {
    const parent = host.current;
    if (!kit || !parent) return;
    const target = mountMathField(kit, parent, "Fórmula");
    field.current = target;

    const fits = load(target, latest.current.text);
    if (!fits) {
      setUnfit(true);
      setLatexMode(true);
    } else {
      if (autoFocus) target.focus();
      if (isTouch()) showKeyboard(true);
    }

    const onInput = (event: Event) => {
      // El editor de texto que rodea al cuadro no debe ver lo que se escribe aquí
      event.stopPropagation();
      const current = target.getValue("latex-expanded");
      const next = fieldResult(loaded.current.original, loaded.current.readBack, current);
      setEmptySlot(hasEmptySlot(current));
      setText(next);
      latest.current.onChange(next);
    };
    // La tecla de retorno del teclado en pantalla confirma, como el Intro del físico
    const onBeforeInput = (event: Event) => {
      event.stopPropagation();
      if ((event as InputEvent).inputType !== "insertLineBreak") return;
      event.preventDefault();
      latest.current.onEnter?.();
    };
    target.addEventListener("input", onInput);
    target.addEventListener("beforeinput", onBeforeInput);

    return () => {
      target.removeEventListener("input", onInput);
      target.removeEventListener("beforeinput", onBeforeInput);
      kit.keyboard.hide({ animate: false });
      kit.keyboard.container = null;
      target.remove();
      field.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar la librería
  }, [kit]);

  // Teclado físico. Se escucha en el DOM y no con React: el cuadro vive dentro del editor de texto,
  // que oye el teclado en su raíz. Nada de lo que se teclea aquí debe llegarle (ni a los atajos de la hoja).
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onKeyDownFirst = (event: KeyboardEvent) => {
      if (event.isComposing || (event.key !== "Enter" && event.key !== "Escape")) return;
      const inField = event.target === field.current;
      // A medio escribir un comando con «\», Intro y Escape son del campo: lo completan o lo cancelan
      if (inField && field.current?.mode === "latex") return;
      const handler = event.key === "Escape" ? latest.current.onEscape : latest.current.onEnter;
      // Varias líneas de LaTeX: Intro a secas es un salto de línea
      const newline = event.key === "Enter" && event.target instanceof HTMLTextAreaElement && !event.ctrlKey && !event.metaKey;
      if (!handler || newline || (event.key === "Enter" && event.shiftKey)) return;
      // La tecla se consume aquí. Si siguiera su curso, el campo leería Escape como «pasar a LaTeX» y,
      // al volver el foco al texto, el Intro partiría el párrafo
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    const stop = (event: Event) => event.stopPropagation();
    const quiet = ["keydown", "keyup", "keypress", "beforeinput", "paste", "cut", "copy", "compositionstart", "compositionupdate", "compositionend"];
    // El campo anuncia por su cuenta que perdió el foco, con eventos fabricados que no dicen adónde fue.
    // El bloque los leería como «el foco salió de aquí» y se cerraría; los del navegador sí pasan.
    const stopMade = (event: Event) => {
      if (!event.isTrusted) event.stopPropagation();
    };
    const made = ["focusin", "focusout", "change"];
    element.addEventListener("keydown", onKeyDownFirst, true);
    for (const type of quiet) element.addEventListener(type, stop);
    for (const type of made) element.addEventListener(type, stopMade);
    return () => {
      element.removeEventListener("keydown", onKeyDownFirst, true);
      for (const type of quiet) element.removeEventListener(type, stop);
      for (const type of made) element.removeEventListener(type, stopMade);
    };
  }, []);

  // El teclado se dibuja pegado al fondo de su contenedor y no le da alto: se lo damos aquí,
  // y el cuadro crece con él sin salirse de la vista
  useEffect(() => {
    if (!kit) return;
    const sync = () => {
      const slot = keyboardHost.current;
      if (!slot) return;
      const open = kit.keyboard.visible && slot.contains(document.querySelector(".ML__keyboard"));
      setKeyboardOpen(open);
      slot.hidden = !open;
      if (!open) return;
      slot.style.height = `${Math.ceil(kit.keyboard.boundingRect.height)}px`;
      root.current?.scrollIntoView({ block: "nearest" });
    };
    kit.keyboard.addEventListener("virtual-keyboard-toggle", sync);
    kit.keyboard.addEventListener("geometrychange", sync);
    return () => {
      kit.keyboard.removeEventListener("virtual-keyboard-toggle", sync);
      kit.keyboard.removeEventListener("geometrychange", sync);
    };
  }, [kit]);

  const toLatex = () => {
    showKeyboard(false);
    setLatexMode(true);
    requestAnimationFrame(() => latexInput.current?.focus());
  };

  const toField = () => {
    const target = field.current;
    if (!target) return;
    if (!load(target, text.trim())) {
      setUnfit(true);
      return;
    }
    setUnfit(false);
    setLatexMode(false);
    requestAnimationFrame(() => {
      target.focus();
      if (isTouch()) showKeyboard(true);
    });
  };

  const editLatex = (next: string) => {
    setText(next);
    if (unfit) setUnfit(false);
    onChange(next);
  };

  const error = text.trim() ? checkLatex(text) : null;
  const loading = !kit && !failed;
  // Sin el campo no hay nada que alternar: queda el cuadro de LaTeX de siempre
  const canSwitch = !failed;
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();
  const LatexTag = display ? "textarea" : "input";

  let note: React.ReactNode = null;
  if (latexMode) {
    if (unfit) note = <span className="crt-mf__note">Esta fórmula usa LaTeX que el campo visual no maneja. Edítala aquí; queda como está.</span>;
  } else if (emptySlot) note = <span className="crt-mf__note crt-mf__note--warn">Hay una casilla vacía en la fórmula.</span>;
  else if (error) note = <span className="crt-mf__note crt-mf__note--warn">El campo escribió algo que la hoja no sabe dibujar. Revísalo en LaTeX.</span>;
  else if (!loading) note = <span className="crt-mf__note">Escribe 3/4, x^2, sqrt, &lt;= o pi. La flecha → sale de la fracción o del exponente.</span>;

  return (
    <span ref={root} className={display ? "crt-mf crt-mf--display" : "crt-mf"}>
      <span className="crt-mf__head">
        <label className="crt-rte__popover-label" htmlFor={latexMode ? id : undefined}>
          {latexMode ? "Fórmula en LaTeX" : "Fórmula"}
        </label>
        {canSwitch && (
          <span className="crt-mf__tools">
            {!latexMode && kit && (
              <button type="button" className="crt-mf__tool" aria-pressed={keyboardOpen} title={keyboardOpen ? "Ocultar el teclado matemático" : "Mostrar el teclado matemático"} onMouseDown={keepFocus} onClick={() => showKeyboard(!keyboardOpen)}>
                <Keyboard aria-hidden="true" />
                Teclado
              </button>
            )}
            <button
              type="button"
              className="crt-mf__tool"
              role="switch"
              aria-checked={latexMode}
              disabled={loading || (latexMode && Boolean(error))}
              title={latexMode ? (error ? "Corrige el LaTeX para volver al campo visual" : "Volver al campo visual") : "Ver y editar el LaTeX"}
              onMouseDown={keepFocus}
              onClick={latexMode ? toField : toLatex}
            >
              LaTeX
            </button>
          </span>
        )}
      </span>

      <span ref={host} className="crt-mf__field" tabIndex={-1} hidden={latexMode}>
        {loading && <span className="crt-mf__loading">Cargando el campo…</span>}
      </span>

      {latexMode && (
        <LatexTag
          ref={latexInput}
          id={id}
          className="crt-input crt-input--code"
          rows={display ? 2 : undefined}
          autoFocus={autoFocus}
          spellCheck={false}
          value={text}
          placeholder="x = \frac{-b}{2a}"
          onChange={event => editLatex(event.target.value)}
        />
      )}

      {note}
      {latexMode && error && <span className="crt-rte__popover-error">{error}</span>}
      {preview && latexMode && !error && (
        <span className="crt-rte__popover-preview" aria-live="polite">
          {text.trim() ? <Formula latex={text} /> : <span className="crt-muted">Vista previa</span>}
        </span>
      )}

      <span ref={keyboardHost} className="crt-mf__keyboard" hidden={!keyboardOpen} />
    </span>
  );
}
