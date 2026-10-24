import puppeteer from "puppeteer-core";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\andre\\.gemini\\antigravity\\brain\\04cc02af-72c5-497d-9132-5c8b93ec3623";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verifyRefinedTeacherDashboard() {
  console.log("Iniciando captura de Teacher Dashboard refinado...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("PAGE BROWSER ERROR:", msg.text());
    }
  });
  page.on("pageerror", (err) => console.log("PAGE RUNTIME ERROR:", err));

  try {
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await sleep(2000);

    // Si está en LoginScreen
    const teacherLoginBtn = await page.$("button ::-p-text(Docente)");
    if (teacherLoginBtn) {
      console.log("Iniciando sesión demo como Docente...");
      await teacherLoginBtn.click();
      await sleep(3000);
    }

    // Diagnostic screenshot
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "diag_current_screen.png") });
    console.log("✔ Diag screen saved.");

    // Wait for teacher-dashboard or body
    await page.waitForSelector(".teacher-dashboard", { timeout: 15000 });
    console.log("✔ TeacherDashboard detectado en pantalla.");

    // 1. Desktop Screenshot
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "27_teacher_dashboard_exact_order_desktop.png"),
    });
    console.log("✔ Guardado: 27_teacher_dashboard_exact_order_desktop.png");

    // 2. Mobile Viewport (390 x 844)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1500);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "28_teacher_dashboard_exact_order_mobile.png"),
    });
    console.log("✔ Guardado: 28_teacher_dashboard_exact_order_mobile.png");

    console.log("TODAS LAS CAPTURAS COMPLETADAS CON ÉXITO.");
  } catch (err) {
    console.error("Error durante la verificación visual:", err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "diag_error_screen.png") });
    throw err;
  } finally {
    await browser.close();
  }
}

verifyRefinedTeacherDashboard().catch((e) => {
  console.error(e);
  process.exit(1);
});
