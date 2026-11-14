// Prueba de humo y plantilla: entra como docente demo, crea un recurso de prueba,
// lo abre en el editor, guarda dos capturas y lo borra.
//
//   node .agents/skills/verificar-creador/scripts/probar.mjs --url http://localhost:3000 --out <carpeta>
//
// Si esto falla, el problema está en el entorno (servidor, base de datos, Chrome), no en tu cambio.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { captureElement, createScratch, loginDemo, newAppPage, openBrowser, openResource, removeScratch } from "./creador.mjs";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    out: { type: "string" },
    role: { type: "string", default: "teacher" },
  },
});
const out = values.out ?? fs.mkdtempSync(path.join(os.tmpdir(), "verificar-creador-"));

const { browser, close } = await openBrowser();
let page = null;
let scratch = null;
try {
  page = await newAppPage(browser);
  await loginDemo(page, values.url, values.role);
  scratch = await createScratch(page, { role: values.role });
  console.log(`Recurso de prueba: id ${scratch.id}, «${scratch.title}»`);

  await openResource(page, values.url, scratch.title);
  const blocks = await page.evaluate(() => [...document.querySelectorAll(".crt--workspace [data-block-id]")].map(el => el.getAttribute("data-block-id")));
  console.log(`Bloques en el editor: ${blocks.length}`);

  await captureElement(page, `[data-block-id="${blocks[0]}"]`, path.join(out, "primer-bloque.png"));
  await captureElement(page, ".crt--workspace .crt-paper", path.join(out, "hoja.png"));
  console.log(`Capturas en ${out}`);
} finally {
  if (scratch && page) {
    await removeScratch(page, scratch.id, values.role)
      .then(() => console.log(`Recurso de prueba ${scratch.id} borrado`))
      .catch(error => console.error(`No pude borrar el recurso ${scratch.id}: ${error.message}`));
  }
  await close();
}
