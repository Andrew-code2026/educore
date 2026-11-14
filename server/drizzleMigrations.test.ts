import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "../drizzle/schema";

// La versión ESM de drizzle-kit/api hace require() dinámicos que fallan en Vitest: se carga la CJS.
// No se usa generateMySQLMigration: ante un renombre pregunta en la terminal y el test se colgaría.
const { generateMySQLDrizzleJson } = createRequire(import.meta.url)("drizzle-kit/api") as typeof import("drizzle-kit/api");

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

  it("las tablas que crea el servidor al primer uso tienen el mismo CREATE TABLE en su migración", () => {
    // Espacios colapsados y sin el `;` final; en el código las comillas invertidas van escapadas.
    const normalize = (statement: string) => statement.replace(/\\`/g, "`").replace(/\s+/g, " ").replace(/;$/, "").trim();
    const byTable = (statements: string[]) =>
      new Map(statements.map(normalize).map((statement) => [statement.match(/`(\w+)`/)![1], statement]));

    const fromMigrations = byTable(
      readdirSync(DRIZZLE_DIR)
        .filter((file) => file.endsWith(".sql"))
        .flatMap((file) => readFileSync(path.join(DRIZZLE_DIR, file), "utf8").split("--> statement-breakpoint"))
        .map((chunk) => chunk.replace(/^--.*$/gm, "").trim())
        .filter((statement) => statement.startsWith("CREATE TABLE IF NOT EXISTS")),
    );
    const serverDir = path.resolve(import.meta.dirname);
    const fromServer = byTable(
      readdirSync(serverDir)
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
        .flatMap((file) => readFileSync(path.join(serverDir, file), "utf8").match(/CREATE TABLE IF NOT EXISTS \\`\w+\\`[\s\S]*?;/g) ?? []),
    );

    expect(fromServer.size).toBeGreaterThan(0);
    expect([...fromMigrations.keys()].sort()).toEqual([...fromServer.keys()].sort());
    for (const [table, statement] of fromServer) expect(fromMigrations.get(table), table).toBe(statement);
  });

  it("el último snapshot coincide con drizzle/schema.ts (drizzle-kit generate no produce nada)", async () => {
    // Si falla, el diff muestra qué tabla o columna cambió: corre `pnpm exec drizzle-kit generate --name=<tema>`.
    const last = readSnapshot(journal.entries[journal.entries.length - 1]);
    // Ida y vuelta por JSON, como lo guarda drizzle-kit (quita los campos undefined).
    const current = JSON.parse(JSON.stringify(await generateMySQLDrizzleJson(schema)));
    expect({ tables: current.tables, views: current.views }).toEqual({ tables: last.tables, views: last.views });
  });
});
