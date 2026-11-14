# Editor del creador: cómo está hecho y qué cuidar

Lo que aprendieron, entre el 12 y el 13 de noviembre de 2026, las tandas que construyeron el editor de «Crear recursos» (PR 38 a 56). Léelo antes de tocar `client/src/creator/`. Para el porqué del diseño frente a otros productos, ver `docs/creador-referentes.md`.

## Piezas y contratos

- **Edición en sitio** (`editing/InlineText.tsx`, `editing/InlineBlockEditor.tsx`, lógica pura en `editing/inlineDraft.ts`). Párrafo, título, recuadro, ejercicio y solución se editan sobre el mismo elemento de la vista, sin salto de diseño. Figuras, tablas, fórmulas sueltas y datos del estudiante usan el panel lateral. Antes de enviar un mensaje a la IA, `CreatorWorkspace` llama a `settle()` del editor abierto para guardar lo que haya.
- **Historial** (`docHistory.ts`). Toda edición que pase por `applyOp` entra sola al historial; las de un mismo bloque, o de título y subtítulo, hechas a menos de 1 s se funden en un paso (`historyKey`). Si una acción debe ser su propio paso, usa `applyOp(op, { ownStep: true })`. Los atajos globales no actúan dentro de `.crt-inplace`, de campos ni de diálogos.
- **Autoguardado** (`useCreatorAutosave.ts`, política en `autosavePolicy.ts`).
  - El servidor responde `CONFLICT` si la versión no coincide y `PRECONDITION_FAILED` mientras la IA trabaja (`CreatorSaveRejected` en `server/creatorDb.ts`). `saveDoc` acepta `overwrite`.
  - Las mutaciones del workspace usan `networkMode: "always"`: con el valor por defecto, React Query las pausa sin aviso cuando el navegador está sin conexión.
  - El servidor funde en una versión las ediciones manuales de 5 minutos y conserva 20 versiones por recurso (`CREATOR_LIMITS.versionsKept`).
- **Estructura** (`structure.ts`, `BlockPicker.tsx`, `useBlockDrag.ts`, `SectionControls.tsx`). `structure.ts` es la única lista de tipos que se pueden añadir. El arrastre usa eventos de puntero propios, sin librería. `move_block_to`, `duplicate_block` y `move_section` existen en `shared/creatorOps.ts` pero no se exponen a la IA.
- **Identidad de objetos.** Lo que llega del servidor pasa por `reuseUnchanged(prev, next)` (`shared/creatorTurn.ts`): los bloques sin cambios conservan su objeto. El historial, la ubicación de cambios y las marcas de la IA dependen de eso. Una operación nueva que copie bloques sin tocarlos debe conservar sus objetos, como ya hace `applyDocOp`.
- **Turnos de la IA** (`shared/creatorTurn.ts`, `turnReview.ts`, `TurnReviewBar.tsx`, `reveal.ts`).
  - Una marca de la IA vale mientras el bloque siga siendo el objeto que ella dejó: mover el bloque no la quita, editarlo o borrarlo sí.
  - `creator.undoTurn` restaura la versión base del turno como versión nueva; si esa versión ya se podó, no puede.
  - La columna `creator_messages.activity` guarda la lista de fichas o un objeto `{ activity, attachments, turn, suggestions }`; léela con `parseMessageExtras`.
- **Copiloto** (`CreatorChat.tsx`). Las etiquetas de las fichas salen de `shared/creatorActivity.ts`, que lee los textos de `applyDocOp`: si cambias esos textos, actualiza el lector. La concordancia de género usa `FEMININE_LABELS`.
- **Panel lateral, tamaño y notas** (`editing/BlockPanel.tsx`, `editing/BlockForm.tsx`, `shared/creatorFigureSize.ts`, `shared/creatorFigureNotes.ts`, `blocks/FigureNotes.tsx`).
  - El panel se monta por portal en `.crt-side-host`: encima del copiloto, flotante si el copiloto está plegado, o a pantalla completa por debajo de 960 px.
  - Tamaños de figura: 0,75 / 1 / 1,3 / completo, con tope del doble del diseño; el plano cartesiano no admite «pequeño».
  - Notas del docente: hasta 6, de 80 caracteres, con posición entre 0 y 1 dentro de la figura.
  - La IA no ve las notas (`withoutTeacherFields`). `keepFigureLayout` y `keepSectionLayout` conservan tamaño y notas cuando la IA reescribe un bloque.
- **Columnas y tarjetas** (`shared/creatorContainers.ts`).
  - Un solo nivel de anidación: `columns` con anchos 1 o 2, y `cards` con 2 a 4 por fila. Las celdas se ubican por `containerId` + `cell`.
  - `placementIssue` decide qué cabe en cada celda, medido sobre papel carta; las operaciones lo imponen y la IA recibe el mismo aviso.
  - `layoutIssues` avisa de columnas desparejas o texto largo en columnas angostas. Si cambias las separaciones en CSS (`--sheet-column-gap`, `--sheet-card-*`), actualiza las constantes del archivo.
  - Clases: `.crt-columns`, `.crt-tiles`, `.crt-tile`, `.crt-cell`. No uses `.crt-card`: es de la portada.
- **Herramientas de la IA.** Los esquemas de bloque van en `$defs` con el nombre del tipo (`nameBlockDefs` en `server/creatorTools.ts`); sin eso cada herramienta pasaría de 38 a 115 KB.
- **Campo de fórmula** (`editing/FormulaInput.tsx`, `editing/mathField.ts`, lógica pura en `editing/formulaLatex.ts`). MathLive se carga en diferido (~820 kB, 227 kB comprimido). Las fórmulas que el campo no puede editar sin estropearlas abren en modo LaTeX. Las respuestas reales del campo están grabadas en `editing/formulaField.fixtures.ts`; para regrabarlas, con la app en desarrollo: `node scripts/creator-formula-fixtures.mjs http://localhost:3000`.

## Trampas de las librerías

**Lexical**
- Suelta el foco con Escape (`KEY_ESCAPE_COMMAND`); aquí soltar el foco es guardar, así que se ataja con prioridad alta.
- Añade un `<br>` tras un decorador al final del párrafo, que tras una fórmula destacada es un renglón de más: se oculta por CSS.
- Su `contenteditable` tiene `white-space: pre-wrap`, así que los espacios dobles del Markdown se verían: se colapsan al cargar.
- Con el foco en el campo de fórmula no coloca el cursor: primero `rootElement.focus()` y luego `editor.update(…)`.

**Medidas en Chrome**
- Un `<input>` o `<textarea>` nunca mide igual que el texto. Para títulos y rótulos se usa `contenteditable="plaintext-only"` sobre el mismo elemento de la vista.
- Dentro de un recuadro con fondo, el campo necesita `background-color: inherit`, o Chrome cambia el suavizado de toda la letra.

**MathLive 0.111**
- `inlineShortcuts`, `menuItems` y `keybindings` fallan («Mathfield not mounted») si se asignan antes de montar el campo.
- Ignora teclas durante ~60 ms tras `focus()`.
- Para saber si hubo cambios, compara `getValue("latex-expanded")` con la lectura inicial.
- El teclado en pantalla no le da alto a su contenedor: tómalo de `mathVirtualKeyboard.boundingRect` en `geometrychange`. Su ancho de tecla es `10cqw`, así que las filas van de diez teclas. Con `--keyboard-zindex` menor que 6 las teclas no escriben.
- Con teclado en pantalla y `pointer: coarse` despacha `blur`/`focusout` fabricados: se cortan cuando `!event.isTrusted`.
- Si Intro devuelve el foco al texto en el mismo `keydown`, consume la tecla en captura o el párrafo se parte.

**react-resizable-panels 3.0.6**
- Intro en el divisor pliega sin llamar a `onCollapse`/`onExpand`; el editor lo intercepta con `onKeyDownCapture`.
- Con ids de `useId`, `expand()` vuelve al mínimo tras remontar: los paneles llevan `id` y `order` fijos.

**Menús de Radix**
- `onCloseAutoFocus` llega tras la animación de salida (~300 ms). La operación se aplica en `onSelect`, solo el foco espera (`useMenuFollowUp`), y los menús llevan `data-[state=closed]:animate-none`.

**CSS del creador**
- Las variables `--sheet-*` solo existen dentro de `.crt-doc`.
- `.crt`, `.crt-doc` (contenedor `sheet`: las columnas se apilan cuando la hoja, no la ventana, se angosta) y el panel lateral son contenedores de consultas. Crean bloque contenedor para `position: fixed`, por eso la etiqueta del arrastre va en un portal a `body`.
- Lo que se pega arriba de la hoja usa `--crt-sticky-top`.

**Punteros y KaTeX**
- Un nodo que se desmonta antes del `pointerup` no recibe `onPointerUp`; el hook del arrastre suelta el estado por su cuenta.
- KaTeX en este proyecto usa clases con prefijo (`katex-base`, `katex-strut`), no `.base`.

## Abierto

- Sin probar en táctil real, Safari, Firefox ni lector de pantalla.
- La primera sección no muestra su título en la hoja y su menú no ofrece «Renombrar».
- El atajo `*…*` puede poner cursiva al escribir productos con asterisco en texto llano («2*3*4»).
- Los mensajes de validación del esquema (zod) siguen en inglés en el panel.
