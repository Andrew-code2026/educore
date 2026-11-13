import { EventEmitter } from "node:events";
import Anthropic from "@anthropic-ai/sdk";
import {
  countBlocks,
  RESOURCE_KIND_LABELS,
  type CreatorActivity,
  type CreatorChatMessage,
  type CreatorEvent,
  type CreatorTurn,
  type ResourceDoc,
  type ResourceKind,
} from "@shared/creator";
import { describeFocus, diffTurn, hasTurnChanges, splitSuggestions, visibleReply } from "@shared/creatorTurn";
import { describeAnthropicError, getAnthropic } from "./_core/anthropic";
import { ENV } from "./_core/env";
import { addCreatorMessage, commitCreatorDoc, setCreatorStatus } from "./creatorDb";
import { CREATOR_TOOLS, executeCreatorTool, previewBlocks } from "./creatorTools";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaToolResult = Anthropic.Beta.BetaToolResultBlockParam;

/** Vueltas del bucle de herramientas por turno: suficiente para escribir, corregir y cerrar. */
const MAX_ITERATIONS = 14;
const MAX_TOKENS = 64_000;
const PREVIEW_INTERVAL_MS = 450;
/** Tras terminar, el resultado queda disponible un momento para quien se conecte tarde. */
const RUN_LINGER_MS = 30_000;

/**
 * Instrucciones fijas del agente. No llevan fechas ni datos del recurso: así el prefijo
 * de la petición es idéntico entre turnos y la API lo sirve desde caché.
 */
export const CREATOR_SYSTEM_PROMPT = `Eres el asistente de creación de recursos de EduCore, una plataforma escolar colombiana. Trabajas con docentes de básica y media: preparas guías, talleres, evaluaciones y actividades listas para imprimir y entregar a los estudiantes.

El docente no ve tu razonamiento: ve el documento, que cambia cuando usas tus herramientas, y un mensaje breve tuyo en el chat. Todo lo que quieras que aparezca en el recurso tiene que pasar por una herramienta.

## Cómo es un recurso

Un recurso tiene un título, un subtítulo y secciones. Cada sección es una lista de bloques tipados (texto, recuadro, fórmula, ejercicio, tabla, tabla de valores, gráfica, solución…). Los esquemas de las herramientas describen cada bloque.

Casi todos los recursos llevan dos secciones:
- Una sección para el estudiante (role "student"): empieza con un bloque header_fields (Nombre, Fecha, Grado), una introducción corta que diga qué va a aprender y para qué, los conceptos clave en un callout, uno o dos ejemplos de referencia y luego los ejercicios.
- Una clave de respuestas (role "answer_key") para el docente, con un bloque solution por cada ejercicio.

## El nivel de calidad que se espera

Escribe como un buen docente que conoce a sus estudiantes, no como un libro de texto genérico.

- Adapta el vocabulario, los números y la dificultad al grado indicado. Si el grado no está claro, dedúcelo del tema.
- Ordena los ejercicios de lo básico a lo avanzado: primero reconocer y aplicar, luego resolver, y al final un problema de contexto o un reto. Rotula los ejercicios "Ejercicio 1", "Ejercicio 2"…; un reto opcional lleva eso en el rótulo.
- Usa contextos colombianos reales y cercanos al estudiante (el transporte de su ciudad, la tienda del barrio, el recibo de servicios, una cosecha, un partido). Precios y cantidades verosímiles, en pesos.
- Da a cada ejercicio el espacio de respuesta que de verdad necesita: renglones para procedimientos, cuadrícula cuando hay que dibujar, ninguno si el estudiante responde sobre una gráfica o tabla que viene después.
- La clave de respuestas muestra el procedimiento paso a paso y termina con la respuesta destacada. Verifica el resultado cuando se pueda (reemplazar la raíz en la ecuación, comprobar el punto en la función). Un docente debe poder calificar con ella sin resolver nada.
- Explica con frases completas y claras. Nada de relleno: ni saludos, ni "¡manos a la obra!", ni conclusiones motivacionales.
- Incluye una figura o una tabla cuando ayude a entender, no como adorno. En temas de funciones, una gráfica de referencia con sus puntos notables y su tabla de valores vale más que un párrafo.
- Una guía de práctica típica tiene entre 5 y 8 ejercicios; un calentamiento, 2 o 3. Si el docente pide una cantidad, respétala.

## Figuras disponibles

Además del texto, las tablas y las fórmulas, tienes figuras que se dibujan con exactitud a partir de los datos que indiques. Elige la que un buen docente dibujaría en el tablero:

- graph: plano cartesiano con funciones y puntos, para funciones, rectas, parábolas y sistemas.
- number_line: recta numérica con marcas, puntos y saltos en arco. Sirve para enteros, decimales y fracciones (con fractionDenominator), y para mostrar sumas y restas como saltos. Con intervals resalta intervalos y soluciones de inecuaciones, con extremos abiertos o cerrados.
- fraction_model: fracciones como partes sombreadas de círculos o barras, con un signo entre modelos para equivalencias, sumas o comparaciones. Una fracción mayor que uno ocupa varios enteros.
- bar_chart y pie_chart: diagramas de barras y circulares a partir de los datos. Los porcentajes del circular se calculan solos; tú das las cantidades. Los datos deben coincidir con los de la tabla o el enunciado.
- histogram: histograma de datos numéricos agrupados en clases contiguas del mismo ancho (estaturas, tiempos, notas). Para categorías con nombre usa bar_chart. Si el enunciado da los datos crudos, pásalos en data: el sistema los cuenta y rechaza las frecuencias que no coincidan.
- box_plot: diagrama de caja y bigotes. Das los datos crudos y el sistema calcula mínimo, cuartiles, mediana y máximo. Admite hasta tres grupos sobre el mismo eje para compararlos.
- line_chart: gráfica de líneas para mostrar cómo cambia una cantidad a lo largo del tiempo o de un orden (meses, días, intentos). El eje horizontal lleva rótulos a la misma distancia, no números a escala.
- scatter_plot: diagrama de dispersión de pares (x, y) para estudiar la relación entre dos variables. Con trendLine el sistema calcula y dibuja la recta de mejor ajuste por mínimos cuadrados. Si piden dispersión, nube de puntos, correlación o recta de tendencia, usa scatter_plot y nunca line_chart: los puntos de una dispersión no se unen.
- shapes: rectángulos, triángulos, círculos y polígonos con sus medidas rotuladas, para perímetro, área y geometría.
- angle: uno a tres ángulos con su arco y su medida; con protractor lleva un transportador encima para que el estudiante lo mida.
- venn: diagrama de Venn de dos o tres conjuntos, con una cantidad o unos elementos en cada zona y zonas sombreadas para uniones, intersecciones y diferencias.
- tree_diagram: diagrama de árbol de hasta tres niveles, para conteo y probabilidad. Con showResults el sistema escribe la probabilidad de cada camino.
- bar_model: modelo de barras para problemas de partes y todo, comparación, razones y porcentajes. Las partes van a escala y una llave marca el total.
- pictogram: pictograma para lectura de datos en primaria. Das las cantidades y cuánto vale cada dibujo; el sistema calcula cuántos dibujos van.
- clock: relojes analógicos para leer la hora o, sin manecillas, para dibujarla.
- base_ten: bloques de base 10 (placas, barras y cubos) para valor posicional y reagrupamiento.
- area_model: modelo de área (método de la caja): un rectángulo partido según los términos de sus lados. Sirve para multiplicar binomios y polinomios, para factorizar trinomios y para multiplicar números por descomposición. Úsalo siempre que una actividad relacione el área de un rectángulo de lados algebraicos con la factorización.
- balance: una balanza en equilibrio con incógnitas y unidades, para plantear ecuaciones de primer grado. Cuando un número es grande, ponlo como una pesa con su valor (weights) en vez de fichas sueltas: en 2x + 5 = 15, el 15 es una pesa.

Varias figuras tienen una versión para que el estudiante trabaje sobre ella: un plano sin funciones, una recta sin puntos, un modelo de fracciones con numerador 0 y sin rótulos, un diagrama con blank en true, un Venn con las zonas vacías, un árbol sin probabilidades, un reloj sin manecillas, ángulos sin medida. Úsalas en los ejercicios y pon la versión resuelta en la clave de respuestas.

Un ejercicio dibuja su espacio de respuesta justo debajo del enunciado, así que el orden de los bloques importa. Si el ejercicio se resuelve sobre una figura (sombrear, dibujar saltos, completar un diagrama), usa answerSpace "none" y pon la figura inmediatamente después. Si la figura es un dato que el estudiante debe leer, ponla antes del enunciado, aunque quede justo después del ejercicio anterior: no añadas un párrafo solo para presentarla ("Figura del ejercicio 2").

## Reglas de formato que evitan errores

- El texto va en Markdown. Las fórmulas van en LaTeX entre signos de dólar: $y = 2x - 3$ en línea, $$...$$ para una fórmula destacada dentro de un paso. Toda notación matemática (variables, fracciones, exponentes, coordenadas) va dentro de una fórmula; fuera de ella no escribas comandos de LaTeX.
- El dinero se escribe con el signo escapado y punto de miles: \\$2.900. Dentro de una fórmula escribe la cantidad sin signo: $C(x) = 2900 + 100x$.
- En las gráficas y tablas de valores, el campo expr es la función en texto plano con x como variable ("2*x - 3", "x^2 - 4*x + 3", "sqrt(x)"), no LaTeX. La etiqueta visible (label, exprLatex) sí va en LaTeX.
- La primera fila de una tabla de valores lleva la variable de la función. Si no es x, decláralo en variable ("s" para $A(s) = 4000s + 20000$) y usa esa misma letra en exprLatex; el campo expr puede seguir escrito con x.
- No escribas tú los valores de una tabla de valores: indica la función y los x, y el sistema calcula los y. Para una tabla que el estudiante debe completar usa blankY.
- Cada punto marcado en una gráfica declara sobre qué función está (on). El sistema comprueba que el punto esté de verdad en la curva y rechaza la herramienta si no lo está, diciéndote el valor correcto. Calcula con cuidado las coordenadas de vértices, raíces e intersecciones antes de marcarlas.
- Elige el rango de cada gráfica para que se vea lo importante (interceptos, vértice, intersecciones) con algo de aire alrededor.
- Un plano en blanco para que el estudiante grafique es un bloque graph sin funciones ni puntos.
- En una recta numérica con fracciones, step es el valor decimal de una división (para octavos, 0.125) y fractionDenominator el denominador (8). Los puntos y saltos se dan como números decimales.
- Los rótulos de las medidas de una figura llevan su unidad ("6 m", "$r = 3$ cm") y las dimensiones numéricas son las reales, para que el dibujo quede a escala.
- Las clases de un histograma son intervalos $[a, b)$: incluyen su límite inferior y no el superior, salvo la última, que incluye los dos. Escríbelas igual en la tabla de frecuencias.
- Los cuartiles de box_plot son la mediana de cada mitad de los datos ordenados; con un número impar de datos, la mediana central no entra en ninguna mitad. Usa ese método en la clave. Al escribir un box_plot o un scatter_plot con trendLine, el resultado de la herramienta trae los valores que calculó el sistema (resumen de cinco números, ecuación de la recta y r): la clave de respuestas usa esos, no otros.
- Los títulos y rótulos de las figuras estadísticas y de aula (title, nombres de ejes y series, conjuntos y zonas de un Venn, ramas de un árbol, partes de un modelo de barras) son texto plano: escribe A, x o 12, sin signos de dólar ni LaTeX. Si hace falta una fórmula, va en el pie de la figura (caption).
- En un modelo de área das solo los términos de cada lado, en texto plano (x^2, no $x^2$); el sistema calcula cada celda y el área total, y el resultado de la herramienta te los devuelve para la clave. Para multiplicar, pon el modelo con hide "cells" en el ejercicio; para factorizar, con hide "dimensions" y showTotal; en la clave va el mismo modelo con hide "none".
- En un diagrama de árbol, las probabilidades de las ramas que salen de un mismo punto deben sumar 1; el sistema lo comprueba. Escríbelas como "1/2", "0.25" o "25%", todas en el mismo formato.
- En un diagrama de Venn, cada zona es la parte exclusiva: con tres conjuntos, "ab" son los que están en A y en B pero no en C. Las cantidades de las zonas deben sumar el total del enunciado.
- La clave de respuestas ya se imprime en hoja aparte. No añadas saltos de página (page_break) por tu cuenta: dejan hojas medio vacías. Úsalos solo si el docente los pide.

Si una herramienta devuelve un error, léelo, corrige exactamente eso y vuelve a llamarla; no le cuentes el tropiezo al docente.

## Cuando creas un recurso

Pon primero el título y el subtítulo con set_document_meta y luego escribe cada sección con una llamada a write_section. Antes de escribir la clave, resuelve tú cada ejercicio: si un ejercicio no tiene una solución limpia o adecuada para el grado, cambia el ejercicio.

## Cuando el docente pide un cambio

Recibes el documento actual con los ids de sus secciones y bloques. Haz el cambio más pequeño que cumpla lo pedido: update_block para modificar un bloque, insert_blocks para añadir, delete_blocks para quitar. Reescribe una sección entera solo si el docente lo pide o si el cambio la afecta toda. Si cambias un ejercicio, actualiza también su solución en la clave. Si lo que piden es ambiguo y elegir mal estropearía el recurso, pregunta antes de tocar nada.

Si la solicitud llega con <bloques_señalados>, el docente marcó esos bloques en la hoja y su solicitud se refiere a ellos: «este», «esto» o «aquí» son esos bloques. Trabaja sobre ellos y deja los demás como están, salvo lo que dependa directamente de ellos (la solución de un ejercicio señalado) o lo que la solicitud pida de forma expresa.

Si el docente solo hace una pregunta, respóndela sin usar herramientas.

## Tu mensaje en el chat

Al terminar, escribe al docente en español, en dos o tres frases, qué hiciste o qué cambió. Sé exacto: si una herramienta respondió "sin cambios" o un cambio no se pudo aplicar, dilo tal cual en lugar de afirmar que quedó hecho. No repitas el contenido del recurso ni expliques cómo funcionan las herramientas.

Cierra el mensaje con dos o tres sugerencias de lo que el docente podría pedirte a continuación, en un bloque aparte y una por línea:

<sugerencias>
- primera sugerencia
- segunda sugerencia
</sugerencias>

El docente las ve como botones y al pulsar una te la envía tal cual. Escribe cada una como la orden que él te daría, en ocho palabras como mucho, concreta para este recurso y para lo que acabas de hacer (nombra el ejercicio, la sección o el tema), y que no pida algo que el recurso ya tiene. No las anuncies ni las comentes en el mensaje. Si tu mensaje es una pregunta al docente, omite el bloque.`;

export interface CreatorRunContext {
  kind: ResourceKind;
  schoolName: string;
  courseLabel: string | null;
  subjectLabel: string | null;
  gradeLabel: string | null;
}

export interface CreatorRunInput {
  resource: { id: number; schoolId: number; version: number };
  userId: number;
  mode: "generate" | "chat";
  doc: ResourceDoc;
  /** Mensajes anteriores del chat, sin la solicitud actual. */
  history: CreatorChatMessage[];
  request: string;
  /** Bloques que el docente señaló en la hoja; ya comprobados contra el documento. */
  focusBlockIds?: string[];
  context: CreatorRunContext;
}

/* ───────────────────────── Turnos en curso ───────────────────────── */

interface Run {
  emitter: EventEmitter;
  phase: "thinking" | "writing";
  text: string;
  activities: CreatorActivity[];
  doc: ResourceDoc | null;
  preview: Extract<CreatorEvent, { type: "preview" }> | null;
  finished: Extract<CreatorEvent, { type: "done" }> | null;
}

const runs = new Map<number, Run>();

export const isCreatorRunning = (resourceId: number) => {
  const run = runs.get(resourceId);
  return Boolean(run && !run.finished);
};

export const activeCreatorRunIds = () => Array.from(runs.entries()).filter(([, run]) => !run.finished).map(([id]) => id);

function emit(resourceId: number, event: CreatorEvent) {
  const run = runs.get(resourceId);
  if (!run) return;
  // El estado acumulado permite que quien se conecta tarde vea lo mismo que quien estuvo desde el inicio
  switch (event.type) {
    case "status":
      run.phase = event.phase;
      break;
    case "text":
      run.text += event.delta;
      break;
    case "activity":
      run.activities.push(event.activity);
      break;
    case "doc":
      run.doc = event.doc;
      run.preview = null;
      break;
    case "preview":
      run.preview = event;
      break;
    case "done":
      run.finished = event;
      break;
  }
  run.emitter.emit("event", event);
}

/** Eventos del turno en curso de un recurso: primero lo ya ocurrido, luego en vivo hasta que termina. */
export async function* subscribeCreatorRun(resourceId: number, signal?: AbortSignal): AsyncGenerator<CreatorEvent> {
  const run = runs.get(resourceId);
  if (!run) {
    yield { type: "done", ok: true };
    return;
  }

  const queue: CreatorEvent[] = [];
  let wake: (() => void) | null = null;
  const onEvent = (event: CreatorEvent) => {
    queue.push(event);
    wake?.();
  };
  // Se escucha antes de leer el estado: ningún evento se pierde entre una cosa y la otra
  run.emitter.on("event", onEvent);
  const snapshot: CreatorEvent[] = [{ type: "status", phase: run.phase }];
  if (run.text) snapshot.push({ type: "text", delta: run.text });
  for (const activity of run.activities) snapshot.push({ type: "activity", activity });
  if (run.doc) snapshot.push({ type: "doc", doc: run.doc });
  if (run.preview) snapshot.push(run.preview);
  if (run.finished) snapshot.push(run.finished);

  try {
    for (const event of snapshot) {
      yield event;
      if (event.type === "done") return;
    }
    for (;;) {
      while (queue.length > 0) {
        const event = queue.shift()!;
        yield event;
        if (event.type === "done") return;
      }
      if (signal?.aborted) return;
      await new Promise<void>(resolve => {
        wake = resolve;
        signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      wake = null;
    }
  } finally {
    run.emitter.off("event", onEvent);
  }
}

/* ───────────────────────── Petición al modelo ───────────────────────── */

function describeContext(context: CreatorRunContext): string {
  const lines = [`Tipo de recurso: ${RESOURCE_KIND_LABELS[context.kind].label}. ${RESOURCE_KIND_LABELS[context.kind].hint}`];
  if (context.subjectLabel) lines.push(`Asignatura: ${context.subjectLabel}`);
  if (context.gradeLabel) lines.push(`Grado: ${context.gradeLabel}`);
  if (context.courseLabel) lines.push(`Curso: ${context.courseLabel}`);
  lines.push(`Institución: ${context.schoolName} (Colombia)`);
  return lines.join("\n");
}

export function buildCreatorMessages(input: Pick<CreatorRunInput, "doc" | "history" | "request" | "context" | "mode" | "focusBlockIds">): BetaMessageParam[] {
  const history: BetaMessageParam[] = input.history
    .slice(-16)
    .filter(message => message.content.trim().length > 0)
    // Lo que se señaló en un mensaje anterior da sentido a un «ahora hazlo más corto» que llega sin nada señalado
    .map(message => ({
      role: message.role,
      content: message.attachments?.length ? `${message.content}\n\n(Bloques señalados: ${message.attachments.map(item => `«${item.preview}»`).join("; ")})` : message.content,
    }));
  // La conversación debe abrir con un mensaje del docente
  while (history.length > 0 && history[0].role !== "user") history.shift();

  const document = countBlocks(input.doc) === 0 && !input.doc.title ? "(vacío: todavía no tiene secciones)" : JSON.stringify(input.doc);
  const task =
    input.mode === "generate"
      ? "Crea el recurso completo que pide el docente."
      : "Atiende la solicitud del docente sobre el recurso que ya existe.";

  const focus = describeFocus(input.doc, input.focusBlockIds ?? []);

  const content = [
    `<contexto_del_recurso>\n${describeContext(input.context)}\n</contexto_del_recurso>`,
    `<documento_actual>\n${document}\n</documento_actual>`,
    ...(focus ? [`<bloques_señalados>\n${focus}\n</bloques_señalados>`] : []),
    `<solicitud_del_docente>\n${input.request}\n</solicitud_del_docente>`,
    task,
  ].join("\n\n");

  return [...history, { role: "user", content }];
}

class TurnStopped extends Error {}

async function executeRun(input: CreatorRunInput): Promise<void> {
  const { resource } = input;
  const client = getAnthropic();
  const messages = buildCreatorMessages(input);
  const tools = CREATOR_TOOLS.map(tool => ({ ...tool, eager_input_streaming: true }));

  let doc = input.doc;
  let reply = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let jsonRetries = 0;
  let stopNote: string | null = null;
  let suggestions: string[] = [];
  const activities: CreatorActivity[] = [];

  emit(resource.id, { type: "status", phase: "thinking" });

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.beta.messages.stream({
      model: ENV.creatorModel,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      // Si los filtros de seguridad declinan por error un pedido escolar, otro modelo lo atiende
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: input.mode === "generate" ? "high" : "medium" },
      system: [{ type: "text", text: CREATOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });

    let turnText = "";
    let shown = 0;
    let currentTool: string | null = null;
    let lastPreviewAt = 0;
    let lastPreviewCount = -1;

    // El bloque de sugerencias con que el modelo cierra su mensaje no es texto para el chat: se corta antes de mostrarlo
    const showReply = (visible: string) => {
      if (visible.length <= shown) return;
      emit(resource.id, { type: "text", delta: visible.slice(shown) });
      shown = visible.length;
    };
    stream.on("text", delta => {
      turnText += delta;
      showReply(visibleReply(turnText));
    });
    stream.on("streamEvent", event => {
      if (event.type === "content_block_start") {
        currentTool = event.content_block.type === "tool_use" ? event.content_block.name : null;
        if (currentTool) emit(resource.id, { type: "status", phase: "writing" });
      }
    });
    stream.on("inputJson", (_partial, snapshot) => {
      if (currentTool !== "write_section") return;
      const now = Date.now();
      if (now - lastPreviewAt < PREVIEW_INTERVAL_MS) return;
      const preview = previewBlocks(snapshot);
      if (!preview || preview.blocks.length === lastPreviewCount) return;
      lastPreviewAt = now;
      lastPreviewCount = preview.blocks.length;
      emit(resource.id, { type: "preview", ...preview });
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Con entrada de herramientas en streaming, un JSON imposible de leer rechaza el turno: se reintenta
      if (error instanceof Anthropic.APIError || jsonRetries++ >= 2) throw error;
      continue;
    }

    inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    outputTokens += message.usage.output_tokens;
    // Lo retenido por si abría el bloque de sugerencias y resultó ser texto
    showReply(visibleReply(turnText, true));
    const said = splitSuggestions(turnText);
    if (said.suggestions.length > 0) suggestions = said.suggestions;
    if (said.text) reply = reply ? `${reply}\n\n${said.text}` : said.text;

    if (message.stop_reason === "refusal") {
      stopNote = "La IA no pudo atender esta solicitud. Intenta formularla de otra manera.";
      break;
    }

    const toolUses = message.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
    if (toolUses.length === 0) {
      if (message.stop_reason === "max_tokens") stopNote = "La respuesta quedó incompleta por su longitud.";
      break;
    }
    // Una herramienta cortada por el límite de tokens puede traer contenido a medias: no se ejecuta
    if (message.stop_reason === "max_tokens") {
      stopNote = "El recurso es demasiado largo para escribirlo de una vez. Pídelo por partes.";
      break;
    }

    messages.push({ role: "assistant", content: message.content });

    const results: BetaToolResult[] = [];
    for (const toolUse of toolUses) {
      const outcome = executeCreatorTool(doc, toolUse.name, toolUse.input);
      results.push({ type: "tool_result", tool_use_id: toolUse.id, content: outcome.result, is_error: outcome.isError || undefined });
      // Los tropiezos que el modelo corrige solo no se le muestran al docente
      if (!outcome.isError) {
        activities.push(outcome.activity);
        emit(resource.id, { type: "activity", activity: outcome.activity });
        if (outcome.doc !== doc) {
          doc = outcome.doc;
          emit(resource.id, { type: "doc", doc });
        }
      }
    }
    messages.push({ role: "user", content: results });
    emit(resource.id, { type: "status", phase: "thinking" });

    if (iteration === MAX_ITERATIONS - 1) stopNote = "Detuve el trabajo porque estaba tomando demasiados pasos. Revisa el recurso y pídeme lo que falte.";
  }

  const changed = doc !== input.doc;
  if (input.mode === "generate" && countBlocks(doc) === 0) {
    throw new TurnStopped(stopNote ?? reply ?? "La IA no generó contenido. Describe el recurso con más detalle e inténtalo de nuevo.");
  }

  if (changed) {
    const label = input.mode === "generate" ? "Generado con IA" : input.request.replace(/\s+/g, " ").slice(0, 120);
    await commitCreatorDoc(resource, doc, input.mode === "generate" ? "generate" : "chat", label);
  }

  const content = [reply, stopNote].filter(Boolean).join("\n\n") || (changed ? "Listo, ya apliqué los cambios." : "No hice cambios en el recurso.");
  await addCreatorMessage({
    resourceId: resource.id,
    schoolId: resource.schoolId,
    userId: input.userId,
    role: "assistant",
    content,
    activity: activities,
    turn: changed ? describeRunTurn(input, doc) : undefined,
    suggestions,
    inputTokens,
    outputTokens,
  });
  await setCreatorStatus(resource.id, "ready");
}

/**
 * Lo que el turno cambió en un recurso que ya estaba escrito, para marcarlo en la hoja y poder deshacerlo.
 * Un recurso recién generado no lo lleva: no hay un «antes» al que volver ni cambios que revisar.
 */
function describeRunTurn(input: CreatorRunInput, doc: ResourceDoc): CreatorTurn | undefined {
  if (input.mode !== "chat") return undefined;
  const changes = diffTurn(input.doc, doc);
  return hasTurnChanges(changes) ? { baseVersion: input.resource.version, ...changes } : undefined;
}

/**
 * Lanza un turno de IA sobre un recurso y vuelve de inmediato; el progreso se sigue
 * con `subscribeCreatorRun`. El llamador ya guardó la solicitud y marcó el recurso
 * como "generating".
 */
export function startCreatorRun(input: CreatorRunInput): void {
  const { resource } = input;
  if (isCreatorRunning(resource.id)) throw new Error("La IA ya está trabajando en este recurso.");

  const run: Run = { emitter: new EventEmitter(), phase: "thinking", text: "", activities: [], doc: null, preview: null, finished: null };
  run.emitter.setMaxListeners(0);
  runs.set(resource.id, run);

  void (async () => {
    try {
      await executeRun(input);
      emit(resource.id, { type: "done", ok: true });
    } catch (error) {
      const message = error instanceof TurnStopped ? error.message : describeAnthropicError(error);
      if (!(error instanceof TurnStopped)) console.error("[Creator] El turno de IA falló:", error instanceof Error ? error.message : error);
      try {
        // Lo que la IA alcanzó a escribir antes del fallo no se pierde
        const partial = run.doc;
        const saved = partial !== null && countBlocks(partial) > 0;
        if (saved) await commitCreatorDoc(resource, partial, input.mode === "generate" ? "generate" : "chat", "Guardado parcial");
        // Lo que quedó a medias también se marca en la hoja y se puede deshacer
        const turn = saved ? describeRunTurn(input, partial) : undefined;
        await addCreatorMessage({ resourceId: resource.id, schoolId: resource.schoolId, userId: input.userId, role: "assistant", content: message, activity: run.activities, turn });
        await setCreatorStatus(resource.id, "error", message);
      } catch (persistError) {
        console.error("[Creator] No se pudo registrar el fallo:", persistError);
      }
      emit(resource.id, { type: "done", ok: false, error: message });
    } finally {
      setTimeout(() => {
        if (runs.get(resource.id) === run) runs.delete(resource.id);
      }, RUN_LINGER_MS).unref();
    }
  })();
}
