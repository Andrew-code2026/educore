---
name: verificar-creador
description: Probar «Crear recursos» (client/src/creator) en un Chrome sin interfaz. Entra con el rol demo, crea y borra un recurso de prueba, lo abre en el editor y captura bloques sin romperlo; también cubre impresión a PDF y simular la IA sin gastar. Úsala para comprobar a ojo un cambio visual o de interacción del creador.
---

# Verificar el creador en el navegador

Necesitas el servidor arriba (`pnpm dev`) y el contenedor `educore-mysql` encendido (ver `AGENTS.md`). Los scripts usan `puppeteer-core`, que ya está en devDependencies, y el Chrome instalado; si no lo encuentran, define `CHROME_PATH`.

## Empieza por la prueba de humo

```bash
node .agents/skills/verificar-creador/scripts/probar.mjs --url http://localhost:3000 --out <carpeta temporal>
```

Entra como docente demo, crea un recurso de prueba con título único, lo abre, guarda `primer-bloque.png` y `hoja.png` y lo borra (unos 10 s). Si falla, el problema está en el entorno, no en tu cambio. Para tu verificación, escribe un script fuera del repositorio con `probar.mjs` como plantilla: importa las ayudas de `scripts/creador.mjs` por ruta absoluta (ver [referencia.md](referencia.md)) y añade tus pasos entre abrir el recurso y borrarlo.

| Ayuda (`scripts/creador.mjs`) | Qué hace |
|---|---|
| `openBrowser()` | Lanza Chrome sin interfaz, 1500×3400 a escala 1,5; con `CHROME_DEBUG_URL` se conecta a uno abierto |
| `newAppPage(browser)` | Pestaña lista: acepta «¿Salir del sitio?» y emula el foco de la ventana |
| `loginDemo(page, url, role)` | Ingreso por API con `auth.loginDemo` |
| `trpcQuery` / `trpcMutation` | Llamar a cualquier procedimiento con la forma de superjson |
| `createScratch` / `removeScratch` | Recurso de prueba sin IA (`creator.createSample`) con título único |
| `saveDoc(page, { id, doc })` | Escribir un documento propio en el recurso |
| `openResource(page, url, title)` | Abrir el recurso desde la portada por su título |
| `captureElement(page, selector, file)` | Capturar sin cambiar el tamaño de la ventana |

## Reglas

1. **Recursos de prueba propios.** Todos comparten el docente demo y la base local, y otras personas o agentes pueden estar probando a la vez. Usa un título único, guarda el id apenas lo crees y borra solo esos ids, en un `finally`.
2. **Capturas sin cambiar la ventana.** Siempre `captureBeyondViewport: false`, como hace `captureElement`. Si la ventana cambia, el editor pasa a modo angosto (menos de 960 px) y se remonta: se pierden el foco, el borrador del chat y los formularios abiertos, sin ningún error.
3. **Esperas con `polling: 100`.** En headless `requestAnimationFrame` puede no correr y `waitForFunction` o `waitForSelector` se quedan colgados.
4. **Buscar y hacer clic en la misma función.** La portada y el editor se vuelven a dibujar mientras cargan y los handles de elementos quedan obsoletos («Node is detached»).
5. **No gastes turnos de IA sin permiso.** Para probar la interfaz, simula las respuestas (ver referencia).
6. **Corridas largas con límite.** Envuelve los scripts que pueden colgarse en `timeout <segundos>`.

Interacción con el editor, panel de figuras, fórmulas, impresión, IA simulada y comparación con `main`: [referencia.md](referencia.md).
