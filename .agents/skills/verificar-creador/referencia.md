# Referencia: verificar el creador

Detalle que no hace falta en cada prueba. Se apoya en las ayudas de `scripts/creador.mjs`.

## Scripts propios

Escribe tu script fuera del repositorio e importa las ayudas por ruta absoluta; `puppeteer-core` se resuelve desde el repositorio:

```js
import { pathToFileURL } from "node:url";
const ayudas = await import(pathToFileURL("<repo>/.agents/skills/verificar-creador/scripts/creador.mjs").href);
```

Para varios pasos seguidos, abre un Chrome con `--remote-debugging-port=9222` en segundo plano y corre scripts cortos con `CHROME_DEBUG_URL=http://127.0.0.1:9222`: si uno falla, no pierdes lo anterior.

## Servidor de prueba

- Si varias personas o agentes trabajan en la misma máquina, arranca tu servidor en un puerto libre (`PORT=3077 pnpm dev`). Si el puerto está ocupado toma el siguiente sin avisar: lee el puerto en la salida (`Server running on …`).
- Al terminar, comprueba que el puerto quedó libre. En Windows, detener el `pnpm dev` lanzado en segundo plano puede dejar vivos los procesos de `tsx`, y el puerto sigue respondiendo. En PowerShell, `netstat -ano | Select-String LISTENING | Select-String ':<puerto>\s'` da el PID; detén ese y sus padres (`cross-env`, `tsx watch`) de tu carpeta.
- Nunca detengas procesos filtrando `node` por una línea de comandos genérica (por ejemplo `dist/index.js`): una vez cerró servidores de otras personas.
- Vista previa de la app de escritorio de Claude Code: con el `.claude/launch.json` del repositorio (`pnpm dev`, que usa `tsx watch`) la vista previa se queda en «starting» sin salida. Quien la use puede cambiar en su copia local `runtimeArgs` a `["exec", "cross-env", "NODE_ENV=development", "tsx", "server/_core/index.ts"]`, sin subirlo. Ese modo no recarga solo: reinícialo tras cambiar `server/` o `shared/`.
- Emulación táctil por CDP: `page.mouse.down` se cuelga; usa `page.touchscreen`.

## Datos del creador por API

- Consultas: GET `/api/trpc/<proc>?input=` + `{"json":{…}}` codificado. Mutaciones: POST con `{"json":{…}}`. Respuesta: `{"result":{"data":{"json":…}}}`. El cliente de la app envía en lote (`{"0":{"json":{…}}}`): tenlo en cuenta al interceptar.
- Contenido propio: `saveDoc` conserva los `id` de bloque que escribas, así el script puede ubicar cada bloque con `[data-block-id="…"]`. Antes de usarlo, valida el documento con el propio código: un `.mts` que importe `shared/creator.ts` y `shared/creatorValidate.ts` por `pathToFileURL`, ejecutado con `node node_modules/tsx/dist/cli.mjs`.
- Al salir de un bloque editado en sitio, el autoguardado espera un momento: `creator.get` devuelve el documento viejo durante un instante. Repite la consulta hasta ver el cambio antes de llamar a `saveDoc`, o la respuesta será 409 CONFLICT.

## Interacción con el editor

- Para reemplazar el valor de un campo: foco, Ctrl+A y escribir. El triple clic añade en lugar de reemplazar.
- Botones de la barra de un bloque: haz clic por DOM (`el.click()`); un aviso de sonner en la esquina puede taparlos. La barra aparece 110 ms después de pasar el puntero, y un bloque con foco gana hasta que el puntero se mueve: espera el `.is-active` de ese bloque.
- Para salir de un bloque en edición, haz clic en el título de la barra (`.crt-bar__title`). El margen de la hoja puede ser la barra de desplazamiento, y los clics a menos de ~15 px del separador entre chat y hoja se pierden.
- Panel de figuras: clic por DOM en `[data-block-id="…"] > .crt-block__view`; el panel es `.crt-panel` y «Aplicar» está en `.crt-panel__foot`. Aplicar guarda de verdad: usa un recurso de prueba.
- Interceptar `creator.saveDoc` para no guardar: activa `setRequestInterception` antes de cargar el editor (activarlo después colgó un script) y responde `[{"result":{"data":{"json":{"version":<base+1>}}}}]`.
- «Sin saltos de diseño»: desplaza primero el bloque a la vista y solo entonces mide; compara píxeles en una pestaña auxiliar (`createImageBitmap` y `OffscreenCanvas`) y descarta diferencias de suavizado antes de culpar a las posiciones. Tras abrir una pestaña auxiliar, vuelve con `bringToFront()` a la de la app.
- La hoja no tiene un elemento por sección: agrupa los bloques por `data-block-id`. El LaTeX de cada fórmula dibujada está en su elemento `annotation`; para leer el texto sin fórmulas, clona la vista del bloque y quita `.katex`. Las clases de KaTeX llevan prefijo (`katex-base`, `katex-strut`).
- La hoja (`.crt-doc`) usa `overflow-wrap: anywhere`: una tabla apretada parte palabras a la mitad.
- Campo de fórmula `<math-field>`: espera ~150 ms tras el foco antes de escribir; `|` se escribe con Shift+Backslash; el teclado en pantalla responde a clics reales en sus coordenadas (`page.mouse.click`), no a `el.click()`.
- Módulos de la app dentro de la página de desarrollo: `await import("/src/creator/…")`, y paquetes con `/@id/<paquete>`. Carga las fuentes de KaTeX (`document.fonts.load("16px KaTeX_Main")`) antes de medir.
- Sin conexión: `page.setOfflineMode(true)` hace `navigator.onLine === false`. Para simular el servidor caído con el navegador en línea, aborta las peticiones a `creator.saveDoc`.

## Imprimir o PDF

Reemplaza `window.print` por una función vacía, haz clic en «Imprimir o PDF», espera `body > .crt-print` y genera el PDF con `page.pdf({ preferCSSPageSize: true, printBackground: true })`. Para mirar las páginas, rasterízalas (por ejemplo con PyMuPDF); una pestaña del visor de PDF capturada con `clip` sale en blanco.

## IA simulada o real

- **Sin gastar.** Envuelve `window.fetch` en la página: cambia `aiReady` en la respuesta de `creator.status` y devuelve respuestas falsas para `creator.clarify` y `creator.create` con la forma de superjson. Para que un mensaje del chat no llegue a la IA, bloquea `*creator.sendMessage*` con CDP `Network.setBlockedURLs`. Esto prueba la interfaz y lo que se envía, no el modelo.
- **Real, solo con permiso: cuesta dinero.**
  - Generar: `creator.create` con `{ role, kind, prompt, subjectLabel, gradeLabel, clarifications: [] }` devuelve `{ id }`.
  - Chat: `creator.sendMessage` con `{ role, id, message, blockIds }`.
  - En ambos casos, consulta `creator.get` hasta que `running` sea `false`.
  - En `messages[].activity[].ok` se ve qué herramientas fallaron; los tokens quedan en `creator_messages`.
  - Un recurso completo tarda de 1 a 5 minutos y una edición por chat, de 6 a 25 s.

## Comparar con `main`

Las suites de `server/` que usan la base local pueden fallar por datos o por tiempo de espera (`server/security.test.ts` falla a ratos también en `main`). Para comparar sin tocar tu carpeta:

1. `git worktree add --detach <temporal>/main-wt origin/main`.
2. Enlaza `node_modules` a la carpeta temporal: en Windows con PowerShell `New-Item -ItemType Junction`; en macOS o Linux con `ln -s`.
3. Corre el mismo archivo de tests ahí.
4. Al terminar, quita primero el enlace y después `git worktree remove --force`.
