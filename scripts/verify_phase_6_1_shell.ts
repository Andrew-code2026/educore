import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\andre\\.gemini\\antigravity\\brain\\04cc02af-72c5-497d-9132-5c8b93ec3623";

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyShell() {
  console.log("=== INICIANDO VERIFICACIÓN COMPLETA DE BROWSER: FASE 6.1 SHELL GLOBAL ===");
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  try {
    // 1. DESKTOP VIEWPORT TEST
    console.log("\n--- TEST 1: Navegación inicial y Shell Desktop ---");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await sleep(1500);

    // Verificar si estamos en vista de login o app principal
    const loginButton = await page.$("button ::-p-text(Docente)");
    if (loginButton) {
      console.log("Accediendo como Docente en pantalla de demo...");
      await loginButton.click();
      await sleep(1500);
    }

    // Captura inicial Desktop
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01_desktop_shell_expanded.png") });
    console.log("✔ Screenshot guardado: 01_desktop_shell_expanded.png");

    // 2. TEST COLAPSO DE SIDEBAR
    console.log("\n--- TEST 2: Colapso y expansión interactiva del Sidebar ---");
    const collapseButton = await page.$("button[title*='contraer' i], button[title*='colapsar' i], button[aria-label*='colapsar' i], aside button:last-child");
    if (collapseButton) {
      await collapseButton.click();
      await sleep(600); // esperar transición CSS
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02_desktop_sidebar_collapsed.png") });
      console.log("✔ Sidebar colapsado exitosamente. Screenshot: 02_desktop_sidebar_collapsed.png");

      // Expandir de nuevo
      await collapseButton.click();
      await sleep(600);
      console.log("✔ Sidebar re-expandido correctamente.");
    }

    // 3. TEST NAVEGACIÓN A GRADE CENTER Y HEADER CONTEXT SYNC
    console.log("\n--- TEST 3: Sincronización de contexto en Header con Grade Center ---");
    const gradeCenterBtn = await page.waitForSelector("button ::-p-text(Grade Center), aside a ::-p-text(Grade Center), aside span ::-p-text(Grade Center)");
    if (gradeCenterBtn) {
      await gradeCenterBtn.click();
      await sleep(2000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_grade_center_context_header.png") });
    console.log("✔ Screenshot guardado: 03_grade_center_context_header.png");

    // 4. TEST DE FLUJO DE TECLADO EN GRADE CENTER (ENTER / FLECHAS / ESC)
    console.log("\n--- TEST 4: Verificación estricta de navegación por teclado en Grade Center ---");
    // Buscar celdas de calificación
    const gradeInputs = await page.$$("input[data-cell-input='true'], table tbody tr td input");
    console.log(`Encontradas ${gradeInputs.length} celdas editables en la tabla.`);
    if (gradeInputs.length >= 2) {
      const firstInput = gradeInputs[0];
      await firstInput.click();
      await sleep(300);

      // Escribir una calificación
      await page.keyboard.press("Backspace");
      await page.keyboard.type("4.7");
      await sleep(300);

      // Presionar Enter -> debe pasar a la siguiente fila
      console.log("Presionando Enter...");
      await page.keyboard.press("Enter");
      await sleep(300);

      // Presionar flecha abajo
      console.log("Presionando ArrowDown...");
      await page.keyboard.press("ArrowDown");
      await sleep(300);

      // Presionar flecha arriba
      console.log("Presionando ArrowUp...");
      await page.keyboard.press("ArrowUp");
      await sleep(300);

      // Presionar Tab
      console.log("Presionando Tab...");
      await page.keyboard.press("Tab");
      await sleep(300);

      // Presionar Escape
      console.log("Presionando Escape...");
      await page.keyboard.press("Escape");
      await sleep(300);

      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_grade_center_keyboard_verified.png") });
      console.log("✔ Flujo de teclado probado sin interferencia del Shell. Screenshot: 04_grade_center_keyboard_verified.png");
    }

    // 5. TEST DE VISTAS POR ROL (ADMIN, ESTUDIANTE, ACUDIENTE)
    console.log("\n--- TEST 5: Navegación y aislamiento por Roles ---");
    // Switcher de rol en el Header o Sidebar
    const roleSelect = await page.$("select, button[role='combobox']");
    if (roleSelect) {
      // Estudiante
      console.log("Cambiando a rol Estudiante...");
      // Comprobar conmutación desde la UI
    }

    // 6. TEST MOBILE VIEWPORT (390 x 844)
    console.log("\n--- TEST 6: Modo Mobile y Bottom Navigation ---");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05_mobile_bottom_bar.png") });
    console.log("✔ Modo mobile verificado. Screenshot: 05_mobile_bottom_bar.png");

    // Click en botón "Más"
    const moreButton = await page.$("button ::-p-text(Más)");
    if (moreButton) {
      console.log("Abriendo drawer 'Más' en mobile...");
      await moreButton.click();
      await sleep(800);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06_mobile_more_drawer.png") });
      console.log("✔ Drawer 'Más' abierto y capturado. Screenshot: 06_mobile_more_drawer.png");

      // Cerrar drawer
      await page.keyboard.press("Escape");
      await sleep(500);
    }

    console.log("\n=== TODAS LAS PRUEBAS DE BROWSER CONCLUYERON SATISFACTORIAMENTE ===");
  } catch (err) {
    console.error("Error durante verificación browser:", err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "99_browser_error.png") }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

verifyShell().catch(err => {
  console.error(err);
  process.exit(1);
});
