// Ayudas para probar «Crear recursos» en un Chrome sin interfaz (headless).
// Las usa probar.mjs; impórtalas desde tus propios scripts de verificación.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME_CANDIDATES = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe") : "",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ],
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
};

/** Ruta del navegador: CHROME_PATH si está definida; si no, las ubicaciones habituales del sistema. */
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (CHROME_CANDIDATES[process.platform] ?? []).find(candidate => candidate && fs.existsSync(candidate));
  if (!found) throw new Error("No encontré Chrome. Define CHROME_PATH con la ruta del ejecutable.");
  return found;
}

/**
 * Abre Chrome sin interfaz. Si CHROME_DEBUG_URL está definida (p. ej. http://127.0.0.1:9222),
 * se conecta a ese Chrome en lugar de lanzar otro: útil para varios scripts cortos seguidos.
 * La ventana alta deja bloques enteros a la vista para capturarlos.
 */
export async function openBrowser({ width = 1500, height = 3400, deviceScaleFactor = 1.5 } = {}) {
  const defaultViewport = { width, height, deviceScaleFactor };
  if (process.env.CHROME_DEBUG_URL) {
    const browser = await puppeteer.connect({ browserURL: process.env.CHROME_DEBUG_URL, defaultViewport, protocolTimeout: 120_000 });
    return { browser, close: () => browser.disconnect() };
  }
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    defaultViewport,
    protocolTimeout: 120_000,
    args: ["--no-first-run", "--no-default-browser-check"],
  });
  return { browser, close: () => browser.close() };
}

/** Pestaña lista para la app: tiempos holgados, aviso de salida aceptado y foco emulado. */
export async function newAppPage(browser) {
  const page = await browser.newPage();
  // La primera carga tras arrancar el servidor puede pasar de 30 s mientras Vite compila
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);
  // Con cambios sin guardar el editor pide confirmar al salir; sin esto la navegación se cuelga
  page.on("dialog", dialog => dialog.accept().catch(() => {}));
  // Sin foco, el editor en sitio cree que el docente cambió de ventana: guarda pero no se cierra
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.bringToFront();
  return page;
}

/** Ingreso con el rol demo por la API: más fiable que hacer clic en la pantalla de ingreso. */
export async function loginDemo(page, baseUrl, role = "teacher") {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async role => {
    localStorage.setItem("educore-demo-role", role);
    const res = await fetch("/api/trpc/auth.loginDemo", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { role } }),
    });
    return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 300) };
  }, role);
  if (!result.ok) throw new Error(`auth.loginDemo respondió ${result.status}: ${result.text}`);
}

/** Consulta tRPC desde la página (lleva la cookie de sesión). Devuelve el `json` de superjson. */
export async function trpcQuery(page, proc, input) {
  return page.evaluate(async (proc, input) => {
    const res = await fetch(`/api/trpc/${proc}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`, { credentials: "include" });
    const body = await res.json();
    if (body.error) throw new Error(`${proc}: ${body.error.json?.message ?? JSON.stringify(body.error)}`);
    return body.result.data.json;
  }, proc, input);
}

/** Mutación tRPC desde la página. Devuelve el `json` de superjson. */
export async function trpcMutation(page, proc, input) {
  return page.evaluate(async (proc, input) => {
    const res = await fetch(`/api/trpc/${proc}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    const body = await res.json();
    if (body.error) throw new Error(`${proc}: ${body.error.json?.message ?? JSON.stringify(body.error)}`);
    return body.result.data.json;
  }, proc, input);
}

/** Reemplaza el documento de un recurso (p. ej. para probar con contenido propio). Devuelve la versión nueva. */
export async function saveDoc(page, { role = "teacher", id, doc }) {
  const detail = await trpcQuery(page, "creator.get", { role, id });
  return trpcMutation(page, "creator.saveDoc", { role, id, baseVersion: detail.version, doc });
}

/**
 * Crea un recurso de prueba sin IA a partir de un ejemplo y le pone un título único,
 * para no confundirlo con los recursos de otras personas que prueban con el mismo docente demo.
 * Guarda el id que devuelve y bórralo con removeScratch al terminar.
 */
export async function createScratch(page, { role = "teacher", sample = "funciones", title } = {}) {
  const { id } = await trpcMutation(page, "creator.createSample", { role, sample });
  const finalTitle = title ?? `Prueba ${new Date().toISOString().slice(0, 19).replace("T", " ")} ${Math.random().toString(36).slice(2, 6)}`;
  try {
    const detail = await trpcQuery(page, "creator.get", { role, id });
    await trpcMutation(page, "creator.saveDoc", { role, id, baseVersion: detail.version, doc: { ...detail.doc, title: finalTitle } });
  } catch (error) {
    await removeScratch(page, id, role).catch(() => {});
    throw error;
  }
  return { id, title: finalTitle };
}

/** Borra un recurso de prueba. Usa solo ids que tu script creó. */
export async function removeScratch(page, id, role = "teacher") {
  await trpcMutation(page, "creator.remove", { role, id });
}

/**
 * Abre un recurso desde la portada del creador buscando su tarjeta por título exacto.
 * Espera a que el editor tenga bloques. La URL sigue siendo /creator.
 */
export async function openResource(page, baseUrl, title) {
  const status = page.waitForResponse(response => response.url().includes("creator.status"), { timeout: 120_000 });
  await page.goto(new URL("/creator", baseUrl).href, { waitUntil: "domcontentloaded" });
  await status;
  // polling fijo: en headless requestAnimationFrame puede no correr y la espera por defecto se cuelga.
  // Buscar y hacer clic en la misma función: la portada se vuelve a dibujar mientras carga.
  await page.waitForFunction(
    title => {
      const card = [...document.querySelectorAll("li.crt-card")].find(li => li.querySelector(".crt-card__title")?.textContent === title);
      card?.querySelector("button.crt-card__open")?.click();
      return Boolean(card);
    },
    { polling: 100, timeout: 60_000 },
    title,
  );
  await page.waitForFunction(() => Boolean(document.querySelector(".crt.crt--workspace [data-block-id]")), { polling: 100, timeout: 60_000 });
}

const CAPTURE_STYLE = "*, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }";

/**
 * Captura un elemento sin cambiar el tamaño de la ventana (captureBeyondViewport: false).
 * Si la ventana cambia, el editor pasa a modo angosto y se remonta: se pierden el foco,
 * el borrador del chat y los formularios abiertos. Lo que quede fuera de la ventana se recorta.
 */
export async function captureElement(page, selector, file, { padding = 8 } = {}) {
  const box = await page.evaluate(
    (selector, css) => {
      if (!document.getElementById("crt-capture-style")) {
        const style = document.createElement("style");
        style.id = "crt-capture-style";
        style.textContent = css;
        document.head.append(style);
      }
      const element = document.querySelector(selector);
      if (!element) return null;
      // Centrado si cabe; si es más alto que la ventana, desde arriba
      const tall = element.getBoundingClientRect().height > window.innerHeight * 0.9;
      element.scrollIntoView({ block: tall ? "start" : "center" });
      const rect = element.getBoundingClientRect();
      // puppeteer espera coordenadas del documento, no de la ventana
      return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
    },
    selector,
    CAPTURE_STYLE,
  );
  if (!box) throw new Error(`No encontré ${selector}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({
    path: file,
    captureBeyondViewport: false,
    clip: { x: Math.max(0, box.x - padding), y: Math.max(0, box.y - padding), width: box.width + 2 * padding, height: box.height + 2 * padding },
  });
  return file;
}
