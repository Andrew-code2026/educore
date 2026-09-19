import { describe, expect, it } from "vitest";
import {
  getNavGroupsForRole,
  getFlatNavItemsForRole,
  getMobileBottomNavItems,
  getMoreNavGroups,
  ALL_NAV_ITEMS,
  ROLE_LABELS,
} from "./navigation";
import type { EduRole, Section } from "./shell.types";

describe("EduCore Shell Navigation System", () => {
  const allRoles: EduRole[] = ["admin", "teacher", "student", "guardian"];

  describe("Role labels and basic configuration", () => {
    it("has Spanish display labels for all 4 roles", () => {
      expect(ROLE_LABELS.admin).toBe("Administrador");
      expect(ROLE_LABELS.teacher).toBe("Docente");
      expect(ROLE_LABELS.student).toBe("Estudiante");
      expect(ROLE_LABELS.guardian).toBe("Acudiente");
    });

    it("has metadata registered for all core sections", () => {
      const coreSections: Section[] = [
        "overview",
        "academic",
        "grades",
        "classroom",
        "attendance",
        "calendar",
        "communications",
        "reports",
        "ai",
        "users",
        "settings",
      ];
      for (const section of coreSections) {
        expect(ALL_NAV_ITEMS[section]).toBeDefined();
        expect(ALL_NAV_ITEMS[section].label).toBeTruthy();
        expect(ALL_NAV_ITEMS[section].icon).toBeDefined();
      }
    });
  });

  describe("Role-based navigation grouping", () => {
    it("returns structured groups for teacher with Grade Center and Classroom", () => {
      const groups = getNavGroupsForRole("teacher");
      expect(groups.length).toBe(3);

      const labels = groups.map(g => g.label);
      expect(labels).toContain("Enseñanza");
      expect(labels).toContain("Seguimiento");
      expect(labels).toContain("Comunidad & IA");

      const allItems = groups.flatMap(g => g.items);
      const sectionIds = allItems.map(i => i.id);

      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("grades");
      expect(sectionIds).toContain("classroom");
      expect(sectionIds).toContain("attendance");

      const gradesItem = allItems.find(i => i.id === "grades");
      expect(gradesItem?.label).toBe("Grade Center");
    });

    it("returns structured groups for admin covering institution and operations", () => {
      const groups = getNavGroupsForRole("admin");
      const labels = groups.map(g => g.label);
      expect(labels).toContain("Institución");
      expect(labels).toContain("Operación Educativa");
      expect(labels).toContain("Análisis & Comunidad");

      const allItems = groups.flatMap(g => g.items);
      const sectionIds = allItems.map(i => i.id);
      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("academic");
      expect(sectionIds).toContain("grades");
      expect(sectionIds).toContain("users");
      expect(sectionIds).toContain("settings");
    });

    it("restricts student navigation to learning and personal academic context", () => {
      const groups = getNavGroupsForRole("student");
      const labels = groups.map(g => g.label);
      expect(labels).toContain("Mi Aprendizaje");

      const allItems = groups.flatMap(g => g.items);
      const sectionIds = allItems.map(i => i.id);
      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("grades");
      expect(sectionIds).toContain("classroom");

      // Students should NOT see admin configuration or institutional management
      expect(sectionIds).not.toContain("users");
      expect(sectionIds).not.toContain("settings");

      const gradesItem = allItems.find(i => i.id === "grades");
      expect(gradesItem?.label).toBe("Calificaciones");
    });

    it("restricts guardian navigation to family monitoring", () => {
      const groups = getNavGroupsForRole("guardian");
      const labels = groups.map(g => g.label);
      expect(labels).toContain("Seguimiento Familiar");

      const allItems = groups.flatMap(g => g.items);
      const sectionIds = allItems.map(i => i.id);
      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("grades");
      expect(sectionIds).toContain("attendance");

      // Guardians should NOT see teacher classroom management
      expect(sectionIds).not.toContain("classroom");
      expect(sectionIds).not.toContain("settings");

      const gradesItem = allItems.find(i => i.id === "grades");
      expect(gradesItem?.label).toBe("Rendimiento");
    });
  });

  describe("Mobile Navigation Configuration", () => {
    it("provides exactly 3 priority items for each role in bottom nav bar", () => {
      for (const role of allRoles) {
        const bottomItems = getMobileBottomNavItems(role);
        expect(bottomItems.length).toBe(3);
      }
    });

    it("prioritizes Grade Center in mobile bottom bar for teachers, students, and guardians", () => {
      const teacherBottom = getMobileBottomNavItems("teacher");
      expect(teacherBottom.map(i => i.id)).toContain("grades");

      const studentBottom = getMobileBottomNavItems("student");
      expect(studentBottom.map(i => i.id)).toContain("grades");

      const guardianBottom = getMobileBottomNavItems("guardian");
      expect(guardianBottom.map(i => i.id)).toContain("grades");
    });

    it("separates secondary items into the 'Más' drawer", () => {
      for (const role of allRoles) {
        const moreGroups = getMoreNavGroups(role);
        expect(moreGroups.length).toBeGreaterThan(0);
        // None of the more items should have mobilePriority bottom
        for (const group of moreGroups) {
          for (const item of group.items) {
            expect(item.mobilePriority).toBe("more");
          }
        }
      }
    });
  });

  describe("Flat item mapping", () => {
    it("returns flat list matching total items across groups", () => {
      for (const role of allRoles) {
        const groups = getNavGroupsForRole(role);
        const expectedCount = groups.reduce((acc, g) => acc + g.items.length, 0);
        const flat = getFlatNavItemsForRole(role);
        expect(flat.length).toBe(expectedCount);
      }
    });
  });
});
