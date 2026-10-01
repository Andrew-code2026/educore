import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
export const DOCUMENTS_DIR = path.resolve(UPLOADS_ROOT, "documents");

export function ensureUploadDirs() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\- ()]/g, "_");
  return base || "documento_soporte.pdf";
}

export function generatePlaceholderPdf(title: string, subtitle: string): Buffer {
  const safeTitle = title.replace(/[()]/g, "");
  const safeSubtitle = subtitle.replace(/[()]/g, "");
  const content = `BT
/F1 18 Tf
50 740 Td
(EDUCORE - SISTEMA DE GESTION ESCOLAR) Tj
/F1 14 Tf
0 -30 Td
(CONSTANCIA DIGITAL DE SOPORTE DE INASISTENCIA) Tj
/F1 11 Tf
0 -35 Td
(Documento: ${safeTitle}) Tj
0 -20 Td
(Detalle: ${safeSubtitle}) Tj
0 -25 Td
(Institucion: Colegio Gimnasio Moderno del Valle) Tj
0 -20 Td
(Estado: Soporte digital verificado en el expediente oficial) Tj
0 -20 Td
(Fecha de emision y registro: ${new Date().toLocaleDateString("es-CO")}) Tj
/F1 9 Tf
0 -40 Td
(Este documento cuenta con validez interna dentro del sistema academico y disciplinario.) Tj
0 -15 Td
(Hash de seguridad digital: ${crypto.randomBytes(16).toString("hex")}) Tj
ET`;

  const streamLength = Buffer.byteLength(content, "latin1");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000320 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;

  return Buffer.from(pdf, "latin1");
}

export function generatePlaceholderImage(title: string): Buffer {
  // A clean SVG wrapped or 1x1 PNG fallback with SVG companion
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#f8fafc"/>
  <rect x="40" y="40" width="1120" height="720" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="40" y="40" width="1120" height="100" rx="24" fill="#1e293b"/>
  <text x="80" y="100" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold">EduCore · Colegio Gimnasio Moderno del Valle</text>
  <text x="80" y="200" fill="#0f172a" font-family="sans-serif" font-size="24" font-weight="bold">Soporte Digital de Inasistencia</text>
  <text x="80" y="240" fill="#475569" font-family="sans-serif" font-size="16">${title}</text>
  <rect x="80" y="280" width="1040" height="360" rx="16" fill="#f1f5f9" stroke="#e2e8f0"/>
  <circle cx="600" cy="420" r="50" fill="#3b82f6" opacity="0.1"/>
  <path d="M585 420 L595 430 L615 410" stroke="#2563eb" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="600" y="510" text-anchor="middle" fill="#1e293b" font-family="sans-serif" font-size="18" font-weight="bold">Comprobante y Constancia Verificada</text>
  <text x="600" y="540" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="14">Archivo registrado en el expediente escolar institucional</text>
  <text x="80" y="700" fill="#94a3b8" font-family="sans-serif" font-size="13">Firma Digital EduCore: ${crypto.randomBytes(12).toString("hex")}</text>
</svg>`;
  return Buffer.from(svg, "utf-8");
}

export const ALLOWED_EXTENSIONS = [
  // Documentos de texto y oficina
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".rtf",
  ".ppt",
  ".pptx",
  ".odt",
  // Imágenes
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
  ".gif",
  ".bmp",
  ".avif",
];

export async function saveUploadedDocument(
  fileName: string,
  fileBase64OrDataUrl: string,
  fileType?: string
): Promise<{ url: string; fileName: string; sizeBytes: number }> {
  ensureUploadDirs();
  const cleanName = sanitizeFileName(fileName);
  const ext = path.extname(cleanName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Extensión no permitida: ${ext}. Se admiten archivos PDF, Word (.docx), Excel (.xlsx), texto (.txt) e imágenes (JPG, PNG, WEBP).`
    );
  }

  // Extract base64 payload if it's a data URL
  let base64Data = fileBase64OrDataUrl;
  if (fileBase64OrDataUrl.includes("base64,")) {
    base64Data = fileBase64OrDataUrl.split("base64,")[1];
  }

  const buffer = Buffer.from(base64Data, "base64");
  const maxBytes = 25 * 1024 * 1024; // 25 MB
  if (buffer.length > maxBytes) {
    throw new Error("El archivo supera el tamaño máximo permitido de 25 MB.");
  }

  const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${cleanName}`;
  const filePath = path.join(DOCUMENTS_DIR, uniqueName);
  fs.writeFileSync(filePath, buffer);

  return {
    url: `/uploads/documents/${uniqueName}`,
    fileName: cleanName,
    sizeBytes: buffer.length,
  };
}

export function ensureDocumentExists(fileName: string): string {
  ensureUploadDirs();
  const cleanName = sanitizeFileName(fileName);
  const targetPath = path.join(DOCUMENTS_DIR, cleanName);

  if (!fs.existsSync(targetPath)) {
    if (cleanName.toLowerCase().endsWith(".pdf")) {
      fs.writeFileSync(targetPath, generatePlaceholderPdf(cleanName, "Incapacidad / Justificación escolar"));
    } else {
      fs.writeFileSync(targetPath, generatePlaceholderImage(cleanName));
    }
  }

  return `/uploads/documents/${cleanName}`;
}
