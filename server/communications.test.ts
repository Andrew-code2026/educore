import { describe, expect, it } from "vitest";
import { isAudienceFor } from "@shared/communications";
import { hasPermission } from "./identityModel";

describe("permisos de comunicados", () => {
  it("docentes redactan pero no publican; el administrador hace ambas", () => {
    expect(hasPermission("TEACHER", "communications.create")).toBe(true);
    expect(hasPermission("TEACHER", "communications.send")).toBe(false);
    expect(hasPermission("SCHOOL_ADMIN", "communications.create")).toBe(true);
    expect(hasPermission("SCHOOL_ADMIN", "communications.send")).toBe(true);
  });

  it("estudiantes y acudientes solo leen", () => {
    expect(hasPermission("STUDENT", "communications.create")).toBe(false);
    expect(hasPermission("GUARDIAN", "communications.create")).toBe(false);
  });
});

describe("isAudienceFor", () => {
  it("todo el colegio llega a cualquier lector", () => {
    expect(isAudienceFor("STUDENT", "Todo el colegio")).toBe(true);
    expect(isAudienceFor("GUARDIAN", "Todo el colegio")).toBe(true);
  });

  it("filtra por el público del lector", () => {
    expect(isAudienceFor("GUARDIAN", "Acudientes de 11°")).toBe(true);
    expect(isAudienceFor("STUDENT", "Acudientes de 11°")).toBe(false);
    expect(isAudienceFor("STUDENT", "Docentes")).toBe(false);
    expect(isAudienceFor("STUDENT", "Estudiantes")).toBe(true);
  });
});
