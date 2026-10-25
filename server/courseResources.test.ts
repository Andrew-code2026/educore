import { describe, expect, it } from "vitest";
import { MAX_RESOURCE_BYTES, checkResourceFile } from "@shared/courseResources";

describe("checkResourceFile", () => {
  it("decide el tipo por la extensión y limpia el nombre", () => {
    expect(checkResourceFile("Guía de límites (v2).PDF", 1024)).toEqual({
      ok: true,
      extension: "pdf",
      contentType: "application/pdf",
      storageName: "Guia-de-limites-v2.pdf",
    });
    expect(checkResourceFile("C:\\fakepath\\rúbrica.docx", 10)).toMatchObject({ ok: true, storageName: "rubrica.docx" });
  });

  it("rechaza formatos que podrían ejecutar código o no tienen extensión", () => {
    expect(checkResourceFile("pagina.html", 10).ok).toBe(false);
    expect(checkResourceFile("logo.svg", 10).ok).toBe(false);
    expect(checkResourceFile("archivo", 10).ok).toBe(false);
    expect(checkResourceFile(".pdf", 10).ok).toBe(false);
  });

  it("rechaza archivos vacíos o demasiado grandes", () => {
    expect(checkResourceFile("a.pdf", 0).ok).toBe(false);
    expect(checkResourceFile("a.pdf", MAX_RESOURCE_BYTES + 1).ok).toBe(false);
    expect(checkResourceFile("a.pdf", MAX_RESOURCE_BYTES).ok).toBe(true);
  });
});
