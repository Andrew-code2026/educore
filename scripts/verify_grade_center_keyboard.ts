import puppeteer from "puppeteer-core";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\andre\\.gemini\\antigravity\\brain\\04cc02af-72c5-497d-9132-5c8b93ec3623";

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyGradeCenterKeyboard() {
  console.log("Iniciando prueba de teclado en Grade Center con Puppeteer...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  try {
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await sleep(1500);

    const loginBtn = await page.$("button ::-p-text(Docente)");
    if (loginBtn) {
      await loginBtn.click();
      await sleep(1500);
    }

    // Ir a Grade Center
    const gcNav = await page.waitForSelector("button ::-p-text(Grade Center), aside a ::-p-text(Grade Center)");
    if (gcNav) {
      await gcNav.click();
      await sleep(2000);
    }

    // Esperar a que los botones de celdas aparezcan
    await page.waitForSelector("button[data-cell-id]");
    const cells = await page.$$("button[data-cell-id]");
    console.log(`Encontradas ${cells.length} celdas interactivas en Grade Center.`);

    if (cells.length > 0) {
      // Hacer clic en la primera celda
      console.log("Haciendo clic en la primera celda...");
      await cells[0].click();
      await sleep(500);

      // Esperar a que el input numérico se abra
      const input = await page.$("input[type='number'], input[inputmode='decimal'], div[role='dialog'] input");
      if (input) {
        console.log("Input de calificación detectado. Escribiendo 4.9 y presionando ENTER...");
        await input.focus();
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Backspace");
        await page.keyboard.type("4.9");
        await sleep(300);
        await page.keyboard.press("Enter");
        await sleep(600);
      } else {
        // En caso de que se califique escribiendo directamente sobre el botón con foco
        console.log("Enviando teclas directas a la celda...");
        await page.keyboard.type("4.9");
        await sleep(200);
        await page.keyboard.press("Enter");
        await sleep(500);
      }

      console.log("Capturando screenshot de verificación de teclado y sincronización con Header...");
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_grade_center_keyboard_verified.png") });
      console.log("✔ Screenshot guardado exitosamente: 04_grade_center_keyboard_verified.png");
    }
  } finally {
    await browser.close();
  }
}

verifyGradeCenterKeyboard().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
