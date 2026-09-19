import puppeteer from "puppeteer-core";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\andre\\.gemini\\antigravity\\brain\\04cc02af-72c5-497d-9132-5c8b93ec3623";

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyRoles() {
  console.log("Iniciando captura de vistas por rol con Puppeteer...");
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

    // Si está en LoginScreen, iniciar sesión como Docente primero
    const teacherLoginBtn = await page.$("button ::-p-text(Docente)");
    if (teacherLoginBtn) {
      console.log("Pantalla de Login detectada. Iniciando demo...");
      await teacherLoginBtn.click();
      await sleep(2000);
    }

    const selectSelector = "select[aria-label='Cambiar vista demo']";
    await page.waitForSelector(selectSelector);

    // 1. Rol Estudiante
    console.log("Cambiando a rol Estudiante...");
    await page.select(selectSelector, "student");
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "07_student_view_shell.png") });
    console.log("✔ Screenshot 07_student_view_shell.png guardado.");

    // 2. Rol Acudiente
    console.log("Cambiando a rol Acudiente...");
    await page.select(selectSelector, "guardian");
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "08_guardian_view_shell.png") });
    console.log("✔ Screenshot 08_guardian_view_shell.png guardado.");

    // 3. Rol Administrador
    console.log("Cambiando a rol Administrador...");
    await page.select(selectSelector, "admin");
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "09_admin_view_shell.png") });
    console.log("✔ Screenshot 09_admin_view_shell.png guardado.");
  } finally {
    await browser.close();
  }
}

verifyRoles().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
