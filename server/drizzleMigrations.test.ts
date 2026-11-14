import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";

// La versión ESM de drizzle-kit/api hace require() dinámicos que fallan en Vitest: se carga la CJS.
const { generateMySQLDrizzleJson, generateMySQLMigration } = createRequire(import.meta.url)(
  "drizzle-kit/api",
) as typeof import("drizzle-kit/api");

// Estructura de drizzle/: que `drizzle-kit migrate` aplique todas las migraciones y que
// `drizzle-kit generate` no tenga nada pendiente. No usa la base de datos.

const DRIZZLE_DIR = path.resolve(import.meta.dirname, "..", "drizzle");
const META_DIR = path.join(DRIZZLE_DIR, "meta");

type JournalEntry = { idx: number; when: number; tag: string };
const journal = JSON.parse(readFileSync(path.join(META_DIR, "_journal.json"), "utf8")) as { entries: JournalEntry[] };

const readSnapshot = (entry: JournalEntry) =>
  JSON.parse(readFileSync(path.join(META_DIR, `${entry.tag.split("_")[0]}_snapshot.json`), "utf8"));

describe("migraciones de Drizzle", () => {
  it("cada archivo SQL está en el journal y cada entrada tiene su snapshot", () => {
    const sqlTags = readdirSync(DRIZZLE_DIR)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => file.replace(/\.sql$/, ""))
      .sort();
    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(sqlTags);
    for (const entry of journal.entries) expect(() => readSnapshot(entry)).not.toThrow();
  });

  it("las fechas del journal crecen: el migrador de MySQL salta las anteriores a la última aplicada", () => {
    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      if (index > 0) expect(entry.when).toBeGreaterThan(journal.entries[index - 1].when);
    });
  });

  it("los snapshots forman una cadena", () => {
    const snapshots = journal.entries.map(readSnapshot);
    snapshots.slice(1).forEach((snapshot, index) => expect(snapshot.prevId).toBe(snapshots[index].id));
  });

  it("el último snapshot coincide con drizzle/schema.ts (drizzle-kit generate no produce nada)", async () => {
    const last = readSnapshot(journal.entries[journal.entries.length - 1]);
    const current = await generateMySQLDrizzleJson(schema, last.id);
    expect(await generateMySQLMigration(last, current)).toEqual([]);
  });
});
