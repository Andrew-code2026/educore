import { describe, expect, it } from "vitest";
import { ALL_NAV_ITEMS } from "./navigation";
import {
  DEFAULT_SECTION,
  SECTION_PATHS,
  SECTION_ROUTE_PATTERN,
  isSectionPath,
  pathToSection,
  sectionToPath,
} from "./routes";
import type { Section } from "./shell.types";

describe("EduCore Shell Routes", () => {
  const sections = Object.keys(ALL_NAV_ITEMS) as Section[];

  it("todas las secciones de navegación tienen una ruta", () => {
    for (const section of sections) {
      expect(SECTION_PATHS[section]).toMatch(/^\//);
    }
  });

  it("las rutas son únicas", () => {
    const paths = Object.values(SECTION_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("sectionToPath y pathToSection son inversas", () => {
    for (const section of sections) {
      expect(pathToSection(sectionToPath(section))).toBe(section);
    }
  });

  it("la raíz corresponde a la sección por defecto", () => {
    expect(pathToSection("/")).toBe(DEFAULT_SECTION);
  });

  it("tolera slash final y mayúsculas", () => {
    expect(pathToSection("/grades/")).toBe("grades");
    expect(pathToSection("/Attendance")).toBe("attendance");
  });

  it("rutas desconocidas no pertenecen al shell", () => {
    expect(pathToSection("/no-existe")).toBeNull();
    expect(isSectionPath("/grades/extra")).toBe(false);
  });

  it("el patrón del Route coincide solo con rutas del shell", () => {
    for (const path of Object.values(SECTION_PATHS)) {
      expect(SECTION_ROUTE_PATTERN.test(path)).toBe(true);
    }
    expect(SECTION_ROUTE_PATTERN.test("/grades/")).toBe(true);
    expect(SECTION_ROUTE_PATTERN.test("/404")).toBe(false);
    expect(SECTION_ROUTE_PATTERN.test("/ai")).toBe(false);
    expect(SECTION_ROUTE_PATTERN.test("/gradesx")).toBe(false);
    expect(SECTION_ROUTE_PATTERN.test("/grades/extra")).toBe(false);
  });
});
