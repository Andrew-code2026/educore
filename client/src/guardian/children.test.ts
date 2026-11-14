import { describe, expect, it } from "vitest";
import { sectionHref } from "@/student/links";
import { childHref, childIdFromSearch, pickChild, type GuardianChild } from "./children";

const child = (id: number, name: string, isPrimary = false): GuardianChild => ({ id, name, courseName: "11-2", relationshipType: "PARENT", isPrimary });
const CHILDREN = [child(7, "Sofía Martínez", true), child(8, "Carlos Rojas")];

describe("guardian child selection", () => {
  it("reads only a numeric child id from the URL", () => {
    expect(childIdFromSearch("estudiante=8&materia=2")).toBe(8);
    expect(childIdFromSearch("estudiante=abc")).toBeNull();
    expect(childIdFromSearch("")).toBeNull();
  });

  it("uses the requested child when linked and falls back to the primary one", () => {
    expect(pickChild(CHILDREN, 8)?.id).toBe(8);
    expect(pickChild(CHILDREN, 99)?.id).toBe(7);
    expect(pickChild(CHILDREN, null)?.id).toBe(7);
    expect(pickChild([], 7)).toBeNull();
  });

  it("drops the open subject or task of the previous child when switching", () => {
    expect(childHref("/grades", "estudiante=7&materia=9", 8)).toBe("/grades?estudiante=8");
  });

  it("keeps the selected child when moving between sections", () => {
    expect(sectionHref("grades", "estudiante=8&tarea=3", { materia: 9 })).toBe("/grades?estudiante=8&materia=9");
    expect(sectionHref("attendance", "")).toBe("/attendance");
  });
});
