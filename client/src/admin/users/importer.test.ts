import { describe, expect, it } from "vitest";
import {
  buildErrorReportCsv,
  buildTemplateCsv,
  detectDelimiter,
  IMPORT_MAX_ROWS,
  normalizeRelationship,
  parseDelimited,
  parseImportText,
  splitFullName,
} from "./importer";

describe("detectDelimiter", () => {
  it("reconoce el punto y coma de Excel en español, la coma y la tabulación", () => {
    expect(detectDelimiter("nombres;apellidos;correo")).toBe(";");
    expect(detectDelimiter("nombres,apellidos,correo")).toBe(",");
    expect(detectDelimiter("nombres\tapellidos\tcorreo")).toBe("\t");
  });

  it("ignora separadores dentro de comillas", () => {
    expect(detectDelimiter('"Gómez, Ana";x;y')).toBe(";");
  });
});

describe("parseDelimited", () => {
  it("respeta comillas, comillas escapadas, saltos de línea internos y CRLF", () => {
    const text = '﻿a;b\r\n"Ruiz; Ana";"dijo ""hola"""\r\n"línea\nnueva";x';
    expect(parseDelimited(text, ";")).toEqual([
      ["a", "b"],
      ["Ruiz; Ana", 'dijo "hola"'],
      ["línea\nnueva", "x"],
    ]);
  });
});

describe("splitFullName", () => {
  it("separa nombres y apellidos según la convención colombiana", () => {
    expect(splitFullName("María José Gómez Ruiz")).toEqual({ firstName: "María José", lastName: "Gómez Ruiz" });
    expect(splitFullName("Samuel Ortiz Peña")).toEqual({ firstName: "Samuel", lastName: "Ortiz Peña" });
    expect(splitFullName("Ana Ruiz")).toEqual({ firstName: "Ana", lastName: "Ruiz" });
  });
});

describe("normalizeRelationship", () => {
  it("traduce el parentesco escrito libremente", () => {
    expect(normalizeRelationship("Madre")).toBe("PARENT");
    expect(normalizeRelationship("papá")).toBe("PARENT");
    expect(normalizeRelationship("Tutor legal")).toBe("LEGAL_GUARDIAN");
    expect(normalizeRelationship("Abuela")).toBe("OTHER");
    expect(normalizeRelationship("")).toBeUndefined();
  });
});

describe("parseImportText", () => {
  it("lee la plantilla de estudiantes con encabezados con tildes y celdas vacías", () => {
    const text = "Nombres;Apellidos;Correo Electrónico;Documento;Curso;Teléfono\r\nAna;Ruiz;ANA@Colegio.edu.co;123;11-1;\r\n;;;;;\r\nLuis;Paz;luis@colegio.edu.co;;;3001112233\r\n";
    const result = parseImportText(text, "STUDENT");
    expect(result.error).toBeUndefined();
    expect(result.delimiter).toBe(";");
    expect(result.missingColumns).toEqual([]);
    expect(result.rows).toEqual([
      { line: 2, row: { firstName: "Ana", lastName: "Ruiz", email: "ana@colegio.edu.co", documentId: "123", course: "11-1" } },
      { line: 3, row: { firstName: "Luis", lastName: "Paz", email: "luis@colegio.edu.co", phone: "3001112233" } },
    ]);
  });

  it("acepta una columna de nombre completo pegada desde Excel", () => {
    const text = "Nombre completo\tEmail\tGrupo\nMaría José Gómez Ruiz\tmaria@colegio.edu.co\t11-2";
    const [first] = parseImportText(text, "STUDENT").rows;
    expect(first.row).toMatchObject({ firstName: "María José", lastName: "Gómez Ruiz", course: "11-2" });
  });

  it("interpreta una única columna 'nombre' como nombre completo", () => {
    const result = parseImportText("nombre,correo\nLaura Gómez Arango,laura@colegio.edu.co", "TEACHER");
    expect(result.missingColumns).toEqual([]);
    expect(result.rows[0].row).toMatchObject({ firstName: "Laura", lastName: "Gómez Arango" });
  });

  it("vincula acudientes con el correo del estudiante y el parentesco", () => {
    const text = "nombres;apellidos;correo;correo_estudiante;parentesco\nMariana;Martínez;mariana@correo.com;Ana@Colegio.edu.co;Madre";
    expect(parseImportText(text, "GUARDIAN").rows[0].row).toEqual({
      firstName: "Mariana",
      lastName: "Martínez",
      email: "mariana@correo.com",
      studentEmail: "ana@colegio.edu.co",
      relationship: "PARENT",
    });
  });

  it("informa columnas obligatorias faltantes y columnas ignoradas", () => {
    const result = parseImportText("documento;observaciones\n123;x", "STUDENT");
    expect(result.missingColumns).toEqual(["nombres y apellidos", "correo"]);
    expect(result.ignoredColumns).toEqual(["observaciones"]);
  });

  it("ignora columnas que no aplican al tipo de usuario", () => {
    const result = parseImportText("nombres;apellidos;correo;curso\nLaura;Gómez;laura@x.co;11-1", "TEACHER");
    expect(result.rows[0].row.course).toBeUndefined();
    expect(result.ignoredColumns).toEqual(["curso"]);
  });

  it("limita el lote al máximo permitido", () => {
    const body = Array.from({ length: IMPORT_MAX_ROWS + 3 }, (_, index) => `A${index};B;a${index}@x.co`).join("\n");
    const result = parseImportText(`nombres;apellidos;correo\n${body}`, "STUDENT");
    expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
    expect(result.tooMany).toBe(true);
  });

  it("explica por qué no puede leer un archivo vacío o sin datos", () => {
    expect(parseImportText("   ", "STUDENT").error).toBe("El archivo está vacío.");
    expect(parseImportText("nombres;apellidos;correo", "STUDENT").error).toContain("al menos una persona");
  });
});

describe("plantillas y reportes", () => {
  it("genera la plantilla con BOM, separador ; y se puede volver a leer", () => {
    const csv = buildTemplateCsv("STUDENT");
    expect(csv.startsWith("﻿nombres;apellidos;correo;documento;curso;telefono\r\n")).toBe(true);
    const parsed = parseImportText(csv, "STUDENT");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].row.course).toBe("11-1");
  });

  it("escapa los motivos de error que contienen el separador", () => {
    const csv = buildErrorReportCsv([{ line: 4, name: "Ana Ruiz", email: "ana@x.co", message: "Curso; inexistente" }]);
    expect(csv).toContain('4;Ana Ruiz;ana@x.co;"Curso; inexistente"');
  });
});
