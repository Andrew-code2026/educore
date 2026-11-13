import * as React from "react";

/**
 * Nodo donde los popups flotantes (por ahora, la lista del Select) deben montar su portal.
 *
 * Los diálogos de Radix atrapan el foco y bloquean el scroll fuera de su contenido, y algunos
 * editores se cierran cuando el foco sale de su raíz. Un popup portado a `<body>` queda fuera de
 * esos límites: pierde el teclado, la rueda o cierra el editor. Las superficies así publican su
 * nodo con este contexto y el popup se monta dentro de ellas. Sin proveedor, se monta en `<body>`.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children?: React.ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  );
}

function usePortalContainer() {
  return React.useContext(PortalContainerContext);
}

/**
 * Guarda el nodo de una superficie para pasarlo a `PortalContainerProvider`, sin perder el `ref`
 * que la superficie recibe de fuera.
 */
function usePortalContainerHost<T extends HTMLElement>(forwardedRef?: React.Ref<T>) {
  const [container, setContainer] = React.useState<T | null>(null);
  // Devuelve su limpieza (React 19): así un `ref` de función que también la devuelve recibe la suya
  // en vez de una llamada con `null`.
  const ref = React.useCallback(
    (node: T | null) => {
      setContainer(node);
      let cleanup: void | (() => void) = undefined;
      if (typeof forwardedRef === "function") cleanup = forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
      return () => {
        setContainer(null);
        if (typeof cleanup === "function") cleanup();
        else if (typeof forwardedRef === "function") forwardedRef(null);
        else if (forwardedRef) forwardedRef.current = null;
      };
    },
    [forwardedRef]
  );
  return [container, ref] as const;
}

/** Marca de los popups que se montan dentro de otra superficie (la pone, p. ej., `SelectContent`). */
const NESTED_POPUP_ATTRIBUTE = "data-nested-popup";

/**
 * Radix escucha Escape en `document` (fase de captura), antes que el popup anidado. Las superficies
 * de Radix lo consultan en `onEscapeKeyDown` para que Escape cierre solo el popup abierto: el foco
 * está dentro de un popup marcado o en un disparador de Base UI con su popup abierto.
 */
function isEscapeForNestedPopup(event: KeyboardEvent) {
  const target = event.target;
  return target instanceof Element && target.closest(`[${NESTED_POPUP_ATTRIBUTE}], [data-popup-open]`) !== null;
}

export {
  NESTED_POPUP_ATTRIBUTE,
  PortalContainerProvider,
  isEscapeForNestedPopup,
  usePortalContainer,
  usePortalContainerHost,
};
