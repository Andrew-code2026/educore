import { describe, expect, it } from "vitest";
import {
  getNavGroupsForRole,
  getFlatNavItemsForRole,
  getMobileBottomNavItems,
  getMoreNavGroups,
  ALL_NAV_ITEMS,
  ROLE_LABELS,
  isSectionAllowed,
} from "./navigation";
import type { EduRole, Section } from "./shell.types";

describe("EduCore Shell Navigation System", () => {
  const allRoles: EduRole[] = ["admin", "teacher", "student", "guardian"];

  describe("Role labels and basic configuration", () => {
    it("has Spanish display labels for all 4 roles", () => {
      expect(ROLE_LABELS.admin).toBe("Rectoría / Coordinación");
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
      expect(labels).toContain("Comunidad");

      const allItems = groups.flatMap(g => g.items);
      const sectionIds = allItems.map(i => i.id);

      expect(sectionIds).toContain("overview");
      expect(sectionIds).toContain("grades");
      expect(sectionIds).toContain("classroom");
      expect(sectionIds).toContain("attendance");
      expect(sectionIds).not.toContain("academic");

      const gradesItem = allItems.find(i => i.id === "grades");
      expect(gradesItem?.label).toBe("Grade Center");
    });

    it("returns the rector/coordinator portal without teacher classroom workflows", () => {
      const groups = getNavGroupsForRole("admin");
      expect(groups.map(g => g.label)).toEqual(["Gestión", "Seguimiento", "Comunidad", "Institución"]);

      const sectionIds = groups.flatMap(g => g.items).map(i => i.id);
      expect(sectionIds).toEqual([
        "overview",
        "users",
        "academic",
        "analytics",
        "reports",
        "piar",
        "communications",
        "calendar",
        "settings",
      ]);
      expect(sectionIds).not.toContain("grades");
      expect(sectionIds).not.toContain("classroom");
      expect(sectionIds).not.toContain("attendance");
    });

    it("gives students only their learning and school sections, most used first", () => {
      const groups = getNavGroupsForRole("student");
      expect(groups.map(g => g.label)).toEqual(["Aprendizaje", "Mi colegio"]);

      const sectionIds = groups.flatMap(g => g.items).map(i => i.id);
      expect(sectionIds).toEqual(["overview", "classroom", "grades", "attendance", "calendar", "communications"]);

      const items = groups.flatMap(g => g.items);
      expect(items.find(i => i.id === "classroom")?.label).toBe("Tareas");
      expect(items.find(i => i.id === "grades")?.label).toBe("Calificaciones");
      expect(getMobileBottomNavItems("student").map(i => i.id)).toEqual(["overview", "classroom", "grades"]);
    });

    it("blocks by URL every section outside the student navigation", () => {
      const blocked: Section[] = ["academic", "users", "settings", "reports", "analytics", "piar"];
      for (const section of blocked) expect(isSectionAllowed("student", section)).toBe(false);
      const allowed: Section[] = ["overview", "classroom", "grades", "attendance", "calendar", "communications"];
      for (const section of allowed) expect(isSectionAllowed("student", section)).toBe(true);
    });

    it("keeps the existing guards for teachers and guardians", () => {
      expect(isSectionAllowed("teacher", "academic")).toBe(false);
      expect(isSectionAllowed("teacher", "grades")).toBe(true);
      expect(isSectionAllowed("guardian", "piar")).toBe(false);
      expect(isSectionAllowed("admin", "users")).toBe(true);
    });

    it("gives guardians only their child's follow-up and the school sections", () => {
      const groups = getNavGroupsForRole("guardian");
      expect(groups.map(g => g.label)).toEqual(["Seguimiento", "Colegio"]);
      const allItems = groups.flatMap(g => g.items);
      expect(allItems.map(i => i.id)).toEqual(["overview", "grades", "attendance", "calendar", "communications"]);
      expect(allItems.find(i => i.id === "grades")?.label).toBe("Calificaciones");
    });

    it("blocks by URL every section outside the guardian navigation", () => {
      const blocked: Section[] = ["classroom", "academic", "users", "settings", "reports", "analytics", "piar", "creator"];
      for (const section of blocked) expect(isSectionAllowed("guardian", section)).toBe(false);
      const allowed: Section[] = ["overview", "grades", "attendance", "calendar", "communications"];
      for (const section of allowed) expect(isSectionAllowed("guardian", section)).toBe(true);
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

  describe("Section access", () => {
    it("blocks teacher classroom workflows for the rector/coordinator portal", () => {
      for (const section of ["grades", "classroom", "attendance"] as Section[]) {
        expect(isSectionAllowed("admin", section)).toBe(false);
      }
      expect(isSectionAllowed("admin", "users")).toBe(true);
      expect(isSectionAllowed("admin", "academic")).toBe(true);
    });

    it("keeps the existing restrictions for the other roles", () => {
      expect(isSectionAllowed("teacher", "academic")).toBe(false);
      expect(isSectionAllowed("teacher", "grades")).toBe(true);
      expect(isSectionAllowed("student", "piar")).toBe(false);
      expect(isSectionAllowed("guardian", "piar")).toBe(false);
    });

    it("offers the resource creator to teachers and keeps families out of it", () => {
      expect(getFlatNavItemsForRole("teacher").map(i => i.id)).toContain("creator");
      expect(isSectionAllowed("teacher", "creator")).toBe(true);
      expect(isSectionAllowed("student", "creator")).toBe(false);
      expect(isSectionAllowed("guardian", "creator")).toBe(false);
    });

    it("never lists a section in the sidebar that the role cannot open", () => {
      for (const role of allRoles) {
        for (const item of getFlatNavItemsForRole(role)) {
          expect(isSectionAllowed(role, item.id)).toBe(true);
        }
      }
    });

    it("puts users and academic structure in the admin mobile bottom bar", () => {
      expect(getMobileBottomNavItems("admin").map(i => i.id)).toEqual(["overview", "users", "academic"]);
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
