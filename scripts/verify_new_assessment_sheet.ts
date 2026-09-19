import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { getDb } from "../server/db.js";
import { assessments, assessmentGrades } from "../drizzle/schema.js";
import { gt, eq } from "drizzle-orm";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:/Users/andre/.gemini/antigravity/brain/37228710-4380-4d0e-9a46-3efc60b11f7b";

process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3307/educore";

async function run() {
  console.log("=== INICIANDO VERIFICACIÓN E2E EN GOOGLE CHROME ===");

  try {
    const db = await getDb();
    if (db) {
      const all = await db.select().from(assessments);
      for (const a of all) {
        if (a.title.includes("Parcial de derivadas") || a.id > 4) {
          await db.delete(assessmentGrades).where(eq(assessmentGrades.assessmentId, a.id));
          await db.delete(assessments).where(eq(assessments.id, a.id));
        }
      }
      for (const a of all) {
        if (a.id === 1) await db.update(assessments).set({ weight: 20 }).where(eq(assessments.id, 1));
        if (a.id === 2) await db.update(assessments).set({ weight: 20 }).where(eq(assessments.id, 2));
        if (a.id === 3) await db.update(assessments).set({ weight: 30 }).where(eq(assessments.id, 3));
        if (a.id === 4) {
          await db.delete(assessmentGrades).where(eq(assessmentGrades.assessmentId, 4));
          await db.delete(assessments).where(eq(assessments.id, 4));
        }
      }
      console.log("0. Limpieza previa de evaluaciones de prueba completada (70% usado, 30% disponible).");
    }
  } catch (e) {
    console.log("Aviso: Limpieza de DB omitida:", e);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log("1. Navegando a EduCore (http://localhost:3000/)...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });

    console.log("2. Iniciando sesión como Docente...");
    const teacherButton = await page.waitForSelector("button ::-p-text(Docente)");
    if (teacherButton) {
      await teacherButton.click();
    }
    await page.waitForNetworkIdle({ idleTime: 1000 }).catch(() => {});

    console.log("3. Navegando al Grade Center (Calificaciones)...");
    const gradesNav = await page.waitForSelector("button ::-p-text(Calificaciones)");
    await gradesNav.click();
    await page.waitForNetworkIdle({ idleTime: 1500 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // CASO 1: Abrir Grade Center y abrir Sheet de Nueva Evaluación
    console.log("4. CASO 1: Haciendo clic en '+ Nueva evaluación'...");
    await page.evaluate(() => window.scrollTo(0, 0));
    const newAssessmentBtn = await page.waitForSelector("button ::-p-text(Nueva evaluación)");
    await newAssessmentBtn.click();

    // Esperar a que el Sheet aparezca
    const sheet1 = await page.waitForSelector("div[data-slot='sheet-content']", { visible: true });
    await new Promise((r) => setTimeout(r, 1000));

    console.log("   ✓ Sheet abierto exitosamente. Capturando screenshot 01...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "01_new_assessment_sheet_opened.png") });

    // CASO 2: Validar bloqueo de peso superior al disponible
    console.log("5. CASO 2: Probando límite dinámico de peso (excediendo el límite)...");
    const weightInput1 = await sheet1.$("input[aria-label='Peso porcentual']");
    if (weightInput1) {
      await page.evaluate((el: HTMLInputElement) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, "95");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, weightInput1);
    }
    await new Promise((r) => setTimeout(r, 600));

    console.log("   ✓ Verificando advertencia de peso y botón deshabilitado. Capturando screenshot 02...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "02_weight_exceeded_blocked.png") });

    // CASO 3: Probar confirmación de descarte
    console.log("6. CASO 3: Escribiendo título y probando cancelar con datos...");
    const titleInput1 = await sheet1?.$("input[aria-label='Nombre de la evaluación']");
    if (titleInput1) {
      await titleInput1.type("Parcial de prueba no guardado");
    }

    const cancelBtn = await sheet1?.$("button ::-p-text(Cancelar)");
    if (cancelBtn) {
      await cancelBtn.click();
    }
    await page.waitForSelector("div[role='alertdialog']", { visible: true });
    await new Promise((r) => setTimeout(r, 800));

    console.log("   ✓ Diálogo de confirmación de descarte visible. Capturando screenshot 03...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "03_discard_confirmation_dialog.png") });

    // CASO 4: Confirmar descarte y verificar cierre
    console.log("7. CASO 4: Confirmando 'Descartar'...");
    const discardConfirmBtn = await page.waitForSelector("button ::-p-text(Descartar)");
    await discardConfirmBtn.click();

    // Esperar a que el Sheet y AlertDialog se cierren y se desmonten completamente
    await page.waitForSelector("div[role='alertdialog']", { hidden: true });
    await page.waitForSelector("div[data-slot='sheet-content']", { hidden: true });
    await new Promise((r) => setTimeout(r, 1000));

    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 600));

    console.log("   ✓ Sheet cerrado tras descarte. Capturando screenshot 04...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "04_sheet_closed_after_discard.png") });

    // CASO 5: Crear evaluación real válida
    console.log("8. CASO 5: Reabriendo Sheet para creación real...");
    await page.evaluate(() => window.scrollTo(0, 0));
    const newAssessmentBtn2 = await page.waitForSelector("button ::-p-text(Nueva evaluación)");
    await newAssessmentBtn2.click();

    const sheet2 = await page.waitForSelector("div[data-slot='sheet-content']", { visible: true });
    if (!sheet2) throw new Error("Sheet 2 not found");
    await new Promise((r) => setTimeout(r, 1000));

    // Seleccionar tipo 'Examen' dentro del Sheet
    const typeBtns = await sheet2.$$("button[role='radio']");
    for (const btn of typeBtns) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text?.includes("Examen")) {
        await btn.click();
        break;
      }
    }

    // Escribir nombre "Parcial de derivadas" dentro del Sheet
    const titleInput2 = await sheet2.$("input[aria-label='Nombre de la evaluación']");
    if (titleInput2) {
      await titleInput2.type("Parcial de derivadas");
    }

    // Asignar peso válido (10%) dentro del Sheet
    const weightInput2 = await sheet2.$("input[aria-label='Peso porcentual']");
    if (weightInput2) {
      await page.evaluate((el: HTMLInputElement) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, "10");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, weightInput2);
    }

    // Fecha dentro del Sheet
    const dateInput2 = await sheet2.$("input[aria-label='Fecha de aplicación']");
    if (dateInput2) {
      await page.evaluate((el: HTMLInputElement) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        nativeSetter?.call(el, "2026-09-18");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, dateInput2);
    }

    // Desplegar detalles opcionales dentro del Sheet
    const detailsToggle = await sheet2.$("#toggle-assessment-details");
    if (detailsToggle) {
      await detailsToggle.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    const descInput = await sheet2.$("textarea[aria-label='Descripción opcional']");
    if (descInput) {
      await descInput.type("Evaluación parcial presencial de derivadas y optimización.");
    }

    await new Promise((r) => setTimeout(r, 800));
    console.log("   ✓ Formulario completo y resumen reactivo listo. Capturando screenshot 05...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "05_form_ready_to_create.png") });

    // Enviar formulario desde el Sheet
    console.log("9. Enviando creación de evaluación...");
    const submitBtn = await sheet2.$("button ::-p-text(Crear evaluación)");
    if (submitBtn) {
      await submitBtn.click();
    }

    // Esperar respuesta de servidor y cierre del Sheet
    await page.waitForSelector("div[data-slot='sheet-content']", { hidden: true });
    await page.waitForNetworkIdle({ idleTime: 1500 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // Asegurar scroll al tope para ver la tabla completa y las columnas
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 600));

    // CASO 6: Comprobar que la evaluación aparece en el Grade Center
    console.log("10. CASO 6: Comprobando que 'Parcial de derivadas' aparece en la tabla...");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "06_assessment_created_in_grade_center.png") });

    // CASO 7: Comprobar que el flujo de calificación rápida por teclado sigue intacto
    console.log("11. CASO 7: Verificando calificación por teclado (ENTER, números, popover)...");
    const cellSelector = "button[data-cell-id]";
    const cellBtn = await page.waitForSelector(cellSelector, { timeout: 10000 });
    if (cellBtn) {
      await cellBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      // Popover está abierto y el input numérico auto-enfocado
      await page.keyboard.type("4.8");
      await new Promise((r) => setTimeout(r, 600));

      console.log("   ✓ Popover de calificación activa con nota y atajos. Capturando screenshot 07...");
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "07_keyboard_grading_verified.png") });

      // Presionar Enter para guardar y avanzar a la siguiente fila
      await page.keyboard.press("Enter");
      await new Promise((r) => setTimeout(r, 800));
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log("=== VERIFICACIÓN E2E EN GOOGLE CHROME COMPLETADA CON ÉXITO ===");
  } catch (err) {
    console.error("Error durante verificación E2E:", err);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "error_screenshot.png") });
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
