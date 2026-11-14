# Creador de recursos: referentes y decisiones de diseño

«Crear recursos» (`client/src/creator/`, `server/creator*.ts`, `shared/creator*.ts`) se diseñó mirando tres productos comerciales: **Diffit** (generador de guías), **Chalkie** (fichas, lecciones, plantillas e imágenes) y **MagicSchool** (pantalla inicial). Este documento resume lo que se observó en ellos, qué se tomó, qué se descartó y qué falta.

- Observación de uso normal entre el 11 y el 13 de noviembre de 2026: generar recursos y editarlos como lo haría un docente. Sin código fuente, sin source maps y sin extraer prompts. Estos productos cambian; lo de aquí es lo que se vio en esas fechas.
- Se toman ideas, no material: nunca copies su código, HTML, SVG, textos, temas, ilustraciones ni marca.
- Léelo antes de diseñar algo nuevo del creador, para no repetir el análisis.

## Principios que salieron de la comparación

- **Bloques tipados y figuras deterministas.** El documento es una lista de bloques con tipo y cada figura es una especificación que el navegador dibuja en SVG. No se usan diagramas escritos por el modelo ni imágenes de IA para matemáticas: en Chalkie, 5 de 6 gráficas de una lección de matemáticas eran SVG del modelo convertido a imagen, sin edición y con una etiqueta montada sobre una línea.
- **Validar todo lo calculable.** En Diffit se vio LaTeX crudo en un recuadro, un diagrama circular cuyos porcentajes sumaban 101 % y una clave de respuestas sin las gráficas. EduCore compila cada fórmula, comprueba los puntos contra su curva, calcula las tablas y hace que los porcentajes sumen 100 (ver `shared/creatorValidate.ts`).
- **Números a la colombiana** (punto de miles y coma decimal) en lo que ve el estudiante, con `formatNumberEs`. Chalkie usa punto decimal en recursos en español.
- **Edición en sitio por bloque**, no un documento único tipo ProseMirror: conserva las operaciones por bloque, la validación y las versiones.
- **Lo que ninguno hace y EduCore sí:** marcar en la hoja los bloques que cambió la IA, con revisión y deshacer por turno.
- **Descartado:** lienzo libre de diapositivas con cajas en posición absoluta, figuras dibujadas en el servidor, formularios generados a partir del esquema (salen etiquetas técnicas y campos en JSON crudo) y paginación permanente en pantalla.

## Diffit

**Generación.** Antes de generar puede hacer hasta 3 preguntas de opción múltiple en el idioma del pedido, con «Otra cosa» y «Saltar». Un planificador escribe un esquema de actividades (instrucciones, dependencias, gráficas que necesita, cuál es la clave); las independientes se generan en paralelo y la clave depende de todas. El progreso llega por SSE solo con eventos gruesos (esquema listo, actividad lista, imagen lista, fin) y el cliente vuelve a pedir el documento. Tiempos vistos: 20 s para 16 diapositivas y 48–76 s para una guía de 8–10 páginas.

**Modelo.** Proyecto → recursos (pestañas) → actividades → secciones tipadas: texto (con imagen flotada opcional), recuadro, gráfica, tabla (las celdas pueden ser espacios de respuesta) y área de respuesta.

**Figuras.** Unos 11 tipos parametrizados (plano cartesiano con funciones, cónicas, regiones, polígonos y correlación; recta numérica; fracciones; cuadrícula; barras; circular; líneas; histograma; caja y bigotes; formas; balanza), dibujados en el servidor y editados en un cajón lateral con vista previa, texto añadido y tamaño de presentación (pequeño a completo). Cada cambio va al servidor (~0,5 s). Fallos vistos: una balanza dibujada con formas sueltas y una dispersión con tendencia que salió como gráfica de líneas.

**Imágenes.** Búsqueda web con varios candidatos y su fuente; generación con IA en beta solo cuando el pedido la menciona; el panel permite buscar, subir y cambiar el tamaño. Una imagen web fuera de tema (la ficha escaneada de otra persona) mostró el riesgo de la búsqueda automática.

**Editor.** Cada sección es un editor Lexical de solo lectura que se vuelve editable al hacer clic; barra flotante (formato, fórmula, tamaño, márgenes, menú de sección). La fórmula se escribe como expresión llana («3/4», «2x+1») y el servidor la pasa a LaTeX. Sin «/», sin atajos de Markdown y sin arrastre de bloques. Guarda el recurso entero al salir de una sección, sin indicador.

**Chat.** Una herramienta reescribe una actividad completa a partir de una instrucción; cada paso crea una versión, con una ficha que lleva al cambio y «Deshacer este cambio»; cada respuesta termina con 3 sugerencias. 10–22 s por edición.

**Otros.** 77 plantillas de actividad (organizadores gráficos, vocabulario, respuesta corta). Alineación solo a estándares de EE. UU., nada colombiano. Exporta a Google Docs/Slides/Forms/Classroom, Canva, Word, PowerPoint y PDF.

## Chalkie

**Tipos.** Lección (diapositivas), unidad, cuestionario, ficha, cuaderno y póster, cada uno con un asistente de 3–4 pasos. Con el país en Colombia, la interfaz sale en español y con los grados Transición–11°.

**Dos modelos de documento.** Las fichas son JSON de bloques tipados: título, encabezado, párrafo con matemáticas en línea, lista, imagen, rejilla de tarjetas con bloques dentro, columnas con anchos, caja, tabla con bloques en las celdas, respuesta (caja o líneas), salto de página y solucionario. Las lecciones son HTML con cajas en posición absoluta sobre un lienzo libre.

**Plantillas.** 30 plantillas de ficha en 8 categorías (problemas, comprensión lectora, examen, emparejar, completar, ordenar, boleto de salida, vocabulario, sopa de letras, mapa mental…). Una plantilla es un identificador que viaja con la petición, y dos fichas de la misma plantilla tenían el mismo esqueleto de bloques: es una receta de generación con secciones fijas, no un archivo de maquetación (inferencia). Además, el asistente propone 3 ideas de actividad para el tema y «Añadir sección» ofrece 4 sugerencias y 8 actividades listas.

**Temas.** Fichas: 8 temas que solo cambian tokens (fuentes, colores de título y texto, acento, relleno, bordes y radios, cabecera de tabla, líneas), más 4 tamaños de letra y A4 o Carta; cambiar de tema no cambia las imágenes. Diapositivas: 43 temas etiquetados (primeros años, profesional, baja estimulación, dislexia, baja visión, TDAH), y una llamada de IA los ordena según el tema de la clase. Con plan de pago se crean temas propios con nombre, fuentes, colores, radios y grosor de línea.

**Imágenes.** Cada imagen guarda origen (`ai`, diagrama `svg` o búsqueda web), prompt o consulta, estado, ancho en % y proporción; no guarda atribución ni URL original de las imágenes web y no marca las de IA. Un solo estilo de imagen por recurso, ligado al tema. Selector con tres pestañas: crear con IA (llega en ~20 s), buscar en la web, subir; luego recortar, girar y voltear. Con plan de pago se elige el origen y uno de 8 estilos.

**Diferenciación (de pago).** Refuerzo, Nivel esperado y Ampliación son documentos hermanos. La versión de refuerzo conservó actividades, contexto, imágenes y numeración, simplificó la redacción y cambió las respuestas abiertas por pasos para completar y opciones para marcar.

**Alineación curricular (de pago).** Lista 178 currículos de 33 países, incluidos los DBA y EBC de Colombia, pero para Colombia falló: la sugerencia automática no devolvió nada, las materias salían en inglés, un DBA traía texto basura del PDF del ministerio, faltaban números y evidencias de los DBA, y al elegir el grado del currículo la generación fallaba. No fue posible generar un recurso alineado.

**Marcos de clase.** Por defecto, Yo hago / Hacemos / Haces, 5E, Rosenshine e Inicio / Desarrollo / Cierre. Con 5E los títulos de fase quedaron en inglés dentro de una lección en español.

**Editor.** Un documento Tiptap: el cursor pasa entre bloques de texto; recuadros, tablas, imágenes y columnas son nodos atómicos. «/» en un párrafo vacío, atajos de Markdown, asa de arrastre con Duplicar, Poner en columnas y Eliminar, Ctrl+Z en todo el documento e indicador «Guardado». Guarda los bloques ~1 s después de la última tecla. Vista paginada en pantalla, que partió una tabla entre dos páginas.

**Chat.** Al seleccionar un bloque se adjunta al chat; la petición lleva los bloques elegidos y los visibles en pantalla. Responde con «1 edición realizada», un botón Deshacer y una sugerencia. ~13 s para reescribir un párrafo y ~32 s para una diapositiva con imagen. No muestra en la hoja qué cambió.

**Proveedores** (según su evaluación de impacto de protección de datos pública, no por tráfico observado): Gemini en Vertex AI para el texto y los diagramas; OpenAI para imágenes, el chat de edición y la moderación; búsqueda de imágenes con Serper.

**Fallos vistos.** Tablas partidas entre páginas y páginas casi vacías, diapositivas con medio lienzo vacío, sugerencias en inglés dentro de una ficha en español, motivos decorativos encima del texto en un tema de catálogo.

## MagicSchool: pantalla inicial

La portada del creador (`client/src/creator/CreatorLanding.tsx`) sigue su composición: columna centrada de unos 768 px con saludo y subtítulo; tarjeta de solicitud como protagonista (borde fino y resplandor suave que se oscurece al enfocar); fichas de tipo de recurso debajo; ideas destacadas en rejilla con la primera tarjeta más ancha y fondo teñido por tarjeta; biblioteca abajo; fondo claro con degradado y cuadrícula tenue solo en las esquinas superiores. Se apila en una columna en pantallas angostas.

Diferencias a propósito: paleta, tipografía (Outfit) e iconos (lucide) de EduCore, radios mayores para encajar con el marco de la app, avatar de bot propio, sin mascota ni formas decorativas de su marca.

Decisiones del equipo sobre la portada: siempre se le pregunta a la IA si necesita aclarar algo (se quitó la casilla «Preguntarme antes de crear»), no hay panel de ejemplos («redundante») y no lleva decoración matemática porque el creador no es solo para matemáticas.

## Estado en EduCore (`main`, 13 de noviembre de 2026)

**Hecho.** 31 tipos de bloque, entre ellos 19 figuras con validación (plano cartesiano con funciones, cónicas, regiones, geometría y puntos notables; recta numérica; barras, circular, líneas, dispersión, histograma y caja y bigotes; ángulos, Venn, árbol, pictograma; modelos de barras, de área y de fracciones; reloj, base 10, formas y balanza), tabla de valores, columnas, tarjetas y salto de página. Preguntas aclaratorias antes de generar, edición de texto en sitio, campo de fórmula con MathLive, deshacer global, «/» y atajos de Markdown, duplicar, arrastrar y operaciones de sección, chat con bloques adjuntos y revisión de los cambios del turno, sugerencias generadas, panel lateral de figuras con tamaño de presentación y notas del docente, selector de secciones e impresión o PDF.

**Pendiente**, en el orden propuesto:

1. **Imágenes.** Bloque `image` con origen, prompt o consulta, texto alternativo, ancho, proporción y atribución, que se llena después del texto sin bloquearlo; un estilo por recurso; selector generar / buscar / subir. Las figuras matemáticas siguen siendo tipadas. Antes hay que elegir proveedor de imágenes.
2. **Temas de ficha** como tokens, 6–8 curados.
3. **Plantillas** como recetas con esqueleto fijo de secciones, unas 8 para empezar.
4. **Diferenciación**: refuerzo y ampliación como versiones hermanas.
5. **Alineación a DBA** bien hecha. Es la diferencia más clara: Diffit no tiene currículos colombianos y la de Chalkie no funciona para Colombia.
6. Exportar a Word o Google Docs, y diapositivas, después.
