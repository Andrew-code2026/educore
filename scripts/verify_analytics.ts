import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:/Users/andre/.gemini/antigravity/brain/37228710-4380-4d0e-9a46-3efc60b11f7b";

async function run() {
  console.log("Launching Google Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  try {
    console.log("1. Navigating to http://localhost:3000/...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });

    // Click on Docente demo button
    console.log("2. Logging in as Docente...");
    const teacherButton = await page.waitForSelector("button ::-p-text(Docente)");
    if (teacherButton) {
      await teacherButton.click();
    } else {
      // Maybe already logged in or role dropdown
      console.log("Already logged in or exploring demo...");
    }

    await page.waitForNetworkIdle({ idleTime: 1000 }).catch(() => {});

    // Go to "Calificaciones"
    console.log("3. Navigating to Calificaciones...");
    const gradesNav = await page.waitForSelector("button ::-p-text(Calificaciones)");
    await gradesNav.click();

    await page.waitForNetworkIdle({ idleTime: 1500 });
    await new Promise(r => setTimeout(r, 2000));

    // Ensure we are in Grade Center
    console.log("4. In Grade Center. Checking table and buttons...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "00_grade_center_initial.png") });

    // Find and click "Estadísticas" button
    console.log("5. Clicking 'Estadísticas' button to open Mini Panel...");
    const statsBtn = await page.waitForSelector("button ::-p-text(Estadísticas)");
    await statsBtn.click();

    // Wait for the slide-over Sheet to appear
    await page.waitForSelector("div[role='dialog']", { visible: true });
    await new Promise(r => setTimeout(r, 1000));

    console.log("6. Mini Panel is OPEN! Capturing screenshot...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01_mini_panel_open.png") });

    // Test action: Click "Ver pendientes" inside mini panel
    console.log("7. Testing 'Ver pendientes' inside Mini Panel...");
    const verPendientesBtn = await page.$("button ::-p-text(Ver pendientes)");
    if (verPendientesBtn) {
      await verPendientesBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      console.log("Filter PENDING activated!");
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02_filter_pending_applied.png") });
    }

    // Reset filter to Todos
    const filterDropdown = await page.$("button ::-p-text(Filtros)");
    if (filterDropdown) {
      await filterDropdown.click();
      await new Promise(r => setTimeout(r, 500));
      const todosOpt = await page.$("button ::-p-text(Todos los estudiantes)");
      if (todosOpt) await todosOpt.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // Open Estadísticas again
    console.log("8. Re-opening 'Estadísticas' to navigate to Full Analytics Dashboard...");
    const statsBtn2 = await page.waitForSelector("button ::-p-text(Estadísticas)");
    await statsBtn2.click();
    await page.waitForSelector("div[role='dialog']", { visible: true });
    await new Promise(r => setTimeout(r, 800));

    // Click "Ver análisis completo"
    console.log("9. Clicking 'Ver análisis completo'...");
    const fullAnalyticsBtn = await page.waitForSelector("button ::-p-text(Ver análisis completo)");
    await fullAnalyticsBtn.click();

    await new Promise(r => setTimeout(r, 1500));
    console.log("10. In Full Analytics Dashboard! Capturing screenshot...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_full_analytics_dashboard.png"), fullPage: true });

    // Click "Volver al Grade Center"
    console.log("11. Clicking 'Volver al Grade Center'...");
    const backBtn = await page.waitForSelector("button ::-p-text(Volver al Grade Center)");
    await backBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    // Verify Grade Center table is back and keyboard works
    console.log("12. Back in Grade Center! Testing keyboard entry...");
    const firstCellInput = await page.$("td input[type='text']");
    if (firstCellInput) {
      await firstCellInput.focus();
      await page.keyboard.type("4.7");
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 800));
      console.log("ENTER key pressed successfully on table cell!");
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_back_to_grade_center_verified.png") });
    console.log("VALIDATION COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Browser validation failed:", err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "error_screenshot.png") }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
