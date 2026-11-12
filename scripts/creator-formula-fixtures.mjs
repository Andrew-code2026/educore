// Vuelve a grabar lo que el campo matemático (MathLive) devuelve para las fórmulas de
// client/src/creator/editing/formulaField.fixtures.ts. Úsalo al actualizar la librería:
//
//   1. Arranca la app en desarrollo (pnpm dev).
//   2. node scripts/creator-formula-fixtures.mjs http://localhost:3000
//   3. pnpm test — las pruebas dicen si la versión nueva sigue siendo compatible con KaTeX.
//
// Necesita Chrome; su ruta se puede dar en CHROME_PATH. El guion conserva las fórmulas y las
// teclas del archivo y solo regraba la respuesta del campo.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const puppeteer = require("puppeteer-core");

const base = process.argv[2] ?? "http://localhost:3000";
const file = path.join(root, "client/src/creator/editing/formulaField.fixtures.ts");
// Semilla opcional: un JSON { real, varied, unfit, typed } con las fórmulas a grabar por primera vez
const seed = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : null;

/** Lee una de las listas del archivo: cada fila es un arreglo JSON en su propia línea. */
function readList(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start === -1) return [];
  const body = source.slice(source.indexOf("= [", start) + 3, source.indexOf("\n];", start));
  return body
    .split("\n")
    .map(line => line.trim().replace(/,$/, ""))
    .filter(line => line.startsWith("["))
    .map(line => JSON.parse(line));
}

const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const inputs = seed ?? {
  real: readList(previous, "REAL_FORMULAS").map(row => row[0]),
  varied: readList(previous, "VARIED_FORMULAS").map(row => row[0]),
  unfit: readList(previous, "UNFIT_FORMULAS").map(row => row[0]),
  typed: readList(previous, "TYPED").map(row => row[0]),
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage();
// Sin ventana, la página no tiene el foco y el campo no recibiría las teclas
await (await page.createCDPSession()).send("Emulation.setFocusEmulationEnabled", { enabled: true });
await page.goto(base, { waitUntil: "domcontentloaded" });

// El campo se monta con la misma configuración que usa el editor
const version = await page.evaluate(async () => {
  const { loadMathKit, mountMathField } = await import("/src/creator/editing/mathField.ts");
  const kit = await loadMathKit();
  window.__newField = () => {
    document.querySelector("#fixture-field")?.remove();
    const host = document.createElement("div");
    host.id = "fixture-field";
    document.body.append(host);
    return mountMathField(kit, host, "Fórmula");
  };
  return kit.MathfieldElement.version;
});

const roundTrip = formulas =>
  page.evaluate(
    formulas =>
      formulas.map(latex => {
        const field = window.__newField();
        field.setValue(latex, { silenceNotifications: true, mode: "math" });
        return [latex, field.getValue("latex-expanded"), field.errors.length];
      }),
    formulas,
  );

const KEYS = { "→": "ArrowRight", "←": "ArrowLeft", "⌫": "Backspace", "⇥": "Tab" };
async function typeKeys(keys) {
  await page.evaluate(() => window.__newField().focus());
  // El campo tarda un instante en tomar el foco; las teclas de antes se pierden
  await page.waitForFunction(() => {
    const field = document.querySelector("#fixture-field math-field");
    return field.hasFocus() && field.shadowRoot?.activeElement !== null;
  });
  await new Promise(resolve => setTimeout(resolve, 120));
  for (const key of keys) {
    if (KEYS[key]) await page.keyboard.press(KEYS[key]);
    else if (key === "|") {
      // Sin Mayús, la tecla de la barra es la de la barra invertida, que para el campo abre el modo LaTeX
      await page.keyboard.down("Shift");
      await page.keyboard.press("Backslash");
      await page.keyboard.up("Shift");
    } else await page.keyboard.type(key);
  }
  return [keys, await page.evaluate(() => document.querySelector("#fixture-field math-field").getValue("latex-expanded"))];
}

const real = await roundTrip(inputs.real);
const varied = await roundTrip(inputs.varied);
const unfit = await roundTrip(inputs.unfit);
const typed = [];
for (const keys of inputs.typed) typed.push(await typeKeys(keys));
await browser.close();

const list = rows => rows.map(row => `  ${JSON.stringify(row)},`).join("\n");
fs.writeFileSync(
  file,
  `/**
 * Lo que el campo matemático devuelve de verdad. Grabado con scripts/creator-formula-fixtures.mjs
 * en un navegador; no se edita a mano la respuesta del campo, solo se añaden fórmulas o teclas
 * y se vuelve a grabar.
 */

export const MATHLIVE_VERSION = ${JSON.stringify(version)};

/** Fila: [fórmula guardada, lo que devuelve el campo al recibirla, errores que reporta]. */
type RoundTrip = [original: string, readBack: string, errors: number];

/** Fórmulas del recurso de muestra y de recursos generados por la IA. */
export const REAL_FORMULAS: RoundTrip[] = [
${list(real)}
];

/** Otras formas de LaTeX que la IA puede escribir y que el campo debe poder editar. */
export const VARIED_FORMULAS: RoundTrip[] = [
${list(varied)}
];

/** LaTeX que el campo no representa bien: se edita en modo avanzado. */
export const UNFIT_FORMULAS: RoundTrip[] = [
${list(unfit)}
];

/** Fila: [teclas (→ ← ⌫ ⇥ son teclas de movimiento y borrado), lo que devuelve el campo]. */
export const TYPED: [keys: string, readBack: string][] = [
${list(typed)}
];
`,
);
console.log(`MathLive ${version}: ${real.length} reales, ${varied.length} variadas, ${unfit.length} para el modo avanzado, ${typed.length} tecleadas.`);
