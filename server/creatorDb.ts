import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { creatorMessages, creatorResources, creatorVersions, schools, type CreatorResourceRow } from "../drizzle/schema";
import {
  CREATOR_LIMITS,
  parseDoc,
  RESOURCE_KINDS,
  RESOURCE_STATUS,
  type CreatorActivity,
  type CreatorAttachment,
  type CreatorChatMessage,
  type CreatorTurn,
  type ResourceDoc,
  type ResourceKind,
  type ResourceStatus,
} from "@shared/creator";
import { decideTurnUndo, parseMessageExtras, resolveAttachments, serializeMessageExtras } from "@shared/creatorTurn";
import { getDb, type AcademicActor, writeAcademicAudit } from "./db";

/**
 * Creador de recursos: cada docente tiene su propia biblioteca de recursos generados.
 * Estudiantes y acudientes no tienen acceso; un recurso solo lo ve y edita quien lo creó.
 */
const CREATOR_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR", "TEACHER"];

export const canUseCreator = (actor: AcademicActor) => CREATOR_ROLES.includes(actor.roleKey);

/** Las ediciones manuales seguidas se guardan en una sola versión, no una por tecla. */
const MANUAL_VERSION_WINDOW_MS = 5 * 60 * 1000;

export type VersionReason = "generate" | "chat" | "manual" | "restore" | "sample";

let _tablesEnsured = false;

/** Igual que el PIAR: las tablas se crean al primer uso. */
export async function ensureCreatorTables() {
  if (_tablesEnsured) return;
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`creator_resources\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`schoolId\` int NOT NULL,
      \`ownerUserId\` int NOT NULL,
      \`title\` varchar(200) NOT NULL DEFAULT '',
      \`kind\` varchar(24) NOT NULL DEFAULT 'guia',
      \`courseLabel\` varchar(120) DEFAULT NULL,
      \`subjectLabel\` varchar(120) DEFAULT NULL,
      \`gradeLabel\` varchar(60) DEFAULT NULL,
      \`prompt\` text NOT NULL,
      \`status\` varchar(16) NOT NULL DEFAULT 'generating',
      \`errorMessage\` varchar(500) DEFAULT NULL,
      \`doc\` mediumtext NOT NULL,
      \`version\` int NOT NULL DEFAULT 1,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`creator_resources_owner_idx\` (\`schoolId\`,\`ownerUserId\`,\`updatedAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`creator_versions\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`resourceId\` int NOT NULL,
      \`schoolId\` int NOT NULL,
      \`version\` int NOT NULL,
      \`reason\` varchar(16) NOT NULL,
      \`label\` varchar(200) NOT NULL DEFAULT '',
      \`doc\` mediumtext NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`creator_versions_resource_idx\` (\`resourceId\`,\`version\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`creator_messages\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`resourceId\` int NOT NULL,
      \`schoolId\` int NOT NULL,
      \`userId\` int NOT NULL,
      \`role\` varchar(12) NOT NULL,
      \`content\` text NOT NULL,
      \`activity\` text DEFAULT NULL,
      \`inputTokens\` int NOT NULL DEFAULT 0,
      \`outputTokens\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`creator_messages_resource_idx\` (\`resourceId\`,\`id\`),
      KEY \`creator_messages_usage_idx\` (\`schoolId\`,\`userId\`,\`createdAt\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  _tablesEnsured = true;
}

async function requireDb() {
  await ensureCreatorTables();
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible.");
  return db;
}

function assertCreatorActor(actor: AcademicActor) {
  if (!canUseCreator(actor)) throw new Error("No tienes permisos para crear recursos.");
}

const asKind = (value: string): ResourceKind => ((RESOURCE_KINDS as readonly string[]).includes(value) ? (value as ResourceKind) : "guia");
const asStatus = (value: string): ResourceStatus => ((RESOURCE_STATUS as readonly string[]).includes(value) ? (value as ResourceStatus) : "ready");

export interface CreatorResourceSummary {
  id: number;
  title: string;
  kind: ResourceKind;
  courseLabel: string | null;
  subjectLabel: string | null;
  gradeLabel: string | null;
  status: ResourceStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorResourceDetail extends CreatorResourceSummary {
  prompt: string;
  doc: ResourceDoc;
  version: number;
  messages: CreatorChatMessage[];
}

const summarize = (row: Omit<CreatorResourceRow, "doc" | "prompt" | "version">): CreatorResourceSummary => ({
  id: row.id,
  title: row.title,
  kind: asKind(row.kind),
  courseLabel: row.courseLabel,
  subjectLabel: row.subjectLabel,
  gradeLabel: row.gradeLabel,
  status: asStatus(row.status),
  errorMessage: row.errorMessage,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function serializeDoc(doc: ResourceDoc): string {
  const json = JSON.stringify(doc);
  if (json.length > CREATOR_LIMITS.docBytesMax) throw new Error("El recurso es demasiado largo. Divídelo en dos recursos.");
  return json;
}

/** Un recurso solo es visible para quien lo creó, dentro de su institución. */
async function loadOwned(actor: AcademicActor, id: number): Promise<CreatorResourceRow> {
  const db = await requireDb();
  const row = (
    await db
      .select()
      .from(creatorResources)
      .where(and(eq(creatorResources.id, id), eq(creatorResources.schoolId, actor.schoolId), eq(creatorResources.ownerUserId, actor.userId)))
      .limit(1)
  )[0];
  if (!row) throw new Error("El recurso no existe o no es tuyo.");
  return row;
}

export async function listCreatorResources(actor: AcademicActor): Promise<CreatorResourceSummary[] | null> {
  assertCreatorActor(actor);
  await ensureCreatorTables();
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: creatorResources.id,
      schoolId: creatorResources.schoolId,
      ownerUserId: creatorResources.ownerUserId,
      title: creatorResources.title,
      kind: creatorResources.kind,
      courseLabel: creatorResources.courseLabel,
      subjectLabel: creatorResources.subjectLabel,
      gradeLabel: creatorResources.gradeLabel,
      status: creatorResources.status,
      errorMessage: creatorResources.errorMessage,
      createdAt: creatorResources.createdAt,
      updatedAt: creatorResources.updatedAt,
    })
    .from(creatorResources)
    .where(and(eq(creatorResources.schoolId, actor.schoolId), eq(creatorResources.ownerUserId, actor.userId)))
    .orderBy(desc(creatorResources.updatedAt))
    .limit(100);
  return rows.map(summarize);
}

export async function listCreatorMessages(resourceId: number, limit = 80): Promise<CreatorChatMessage[]> {
  const db = await requireDb();
  const rows = await db.select().from(creatorMessages).where(eq(creatorMessages.resourceId, resourceId)).orderBy(desc(creatorMessages.id)).limit(limit);
  return rows.reverse().map(row => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    // La columna guarda todo lo que acompaña al mensaje: fichas, bloques señalados, cambios del turno y sugerencias
    ...parseMessageExtras(row.activity),
    createdAt: row.createdAt,
  }));
}

export async function getCreatorResource(actor: AcademicActor, id: number): Promise<CreatorResourceDetail> {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, id);
  return { ...summarize(row), prompt: row.prompt, doc: parseDoc(row.doc), version: row.version, messages: await listCreatorMessages(row.id) };
}

export interface CreateResourceInput {
  title: string;
  kind: ResourceKind;
  prompt: string;
  courseLabel?: string | null;
  subjectLabel?: string | null;
  gradeLabel?: string | null;
  /** Documento inicial: vacío cuando lo va a escribir la IA. */
  doc: ResourceDoc;
  status: ResourceStatus;
  reason: VersionReason;
}

export async function createCreatorResource(actor: AcademicActor, input: CreateResourceInput): Promise<{ id: number }> {
  assertCreatorActor(actor);
  const db = await requireDb();
  const doc = serializeDoc(input.doc);
  const inserted = await db
    .insert(creatorResources)
    .values({
      schoolId: actor.schoolId,
      ownerUserId: actor.userId,
      title: input.title.slice(0, 200),
      kind: input.kind,
      courseLabel: input.courseLabel?.slice(0, 120) || null,
      subjectLabel: input.subjectLabel?.slice(0, 120) || null,
      gradeLabel: input.gradeLabel?.slice(0, 60) || null,
      prompt: input.prompt,
      status: input.status,
      doc,
      version: 1,
    })
    .$returningId();
  const id = inserted[0].id;
  if (input.doc.sections.length > 0) {
    await db.insert(creatorVersions).values({ resourceId: id, schoolId: actor.schoolId, version: 1, reason: input.reason, label: "Versión inicial", doc });
  }
  await writeAcademicAudit(actor, "creator_created", "creator_resource", `${id}:${input.kind}`);
  return { id };
}

/**
 * Guarda el documento como nueva versión del recurso. Las ediciones manuales cercanas
 * en el tiempo reutilizan la misma copia para deshacer.
 */
export async function commitCreatorDoc(
  resource: { id: number; schoolId: number; version: number },
  doc: ResourceDoc,
  reason: VersionReason,
  label: string,
  options: { coalesce?: boolean } = {},
): Promise<{ version: number; updatedAt: Date }> {
  const db = await requireDb();
  const json = serializeDoc(doc);
  const version = resource.version + 1;
  const updatedAt = new Date();
  await db
    .update(creatorResources)
    .set({ doc: json, version, title: (doc.title || "Recurso sin título").slice(0, 200), updatedAt })
    .where(eq(creatorResources.id, resource.id));

  const latest = (await db.select().from(creatorVersions).where(eq(creatorVersions.resourceId, resource.id)).orderBy(desc(creatorVersions.id)).limit(1))[0];
  const coalesce = options.coalesce !== false && reason === "manual" && latest?.reason === "manual" && updatedAt.getTime() - latest.createdAt.getTime() < MANUAL_VERSION_WINDOW_MS;
  if (coalesce) {
    await db.update(creatorVersions).set({ doc: json, version }).where(eq(creatorVersions.id, latest.id));
  } else {
    await db.insert(creatorVersions).values({ resourceId: resource.id, schoolId: resource.schoolId, version, reason, label: label.slice(0, 200), doc: json });
    await pruneVersions(resource.id);
  }
  return { version, updatedAt };
}

async function pruneVersions(resourceId: number) {
  const db = await requireDb();
  const kept = await db
    .select({ id: creatorVersions.id })
    .from(creatorVersions)
    .where(eq(creatorVersions.resourceId, resourceId))
    .orderBy(desc(creatorVersions.id))
    .limit(CREATOR_LIMITS.versionsKept);
  if (kept.length < CREATOR_LIMITS.versionsKept) return;
  const oldest = kept[kept.length - 1].id;
  await db.delete(creatorVersions).where(and(eq(creatorVersions.resourceId, resourceId), lt(creatorVersions.id, oldest)));
}

/** Por qué no se aceptó un guardado manual. El cliente decide con esto si reintenta (ver `client/src/creator/autosavePolicy.ts`). */
export class CreatorSaveRejected extends Error {
  constructor(
    readonly reason: "conflict" | "generating",
    message: string,
  ) {
    super(message);
    this.name = "CreatorSaveRejected";
  }
}

/**
 * Edición manual del docente. `baseVersion` evita pisar cambios hechos desde otra pestaña o por la IA.
 * Con `overwrite` el docente eligió guardar su versión encima de otra: va en una versión aparte,
 * sin fundirse con la anterior, para que la que reemplaza siga en el historial.
 */
export async function saveCreatorDoc(actor: AcademicActor, input: { id: number; doc: ResourceDoc; baseVersion: number; overwrite?: boolean }) {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, input.id);
  if (row.status === "generating") throw new CreatorSaveRejected("generating", "La IA está trabajando en este recurso. Espera a que termine para editarlo.");
  if (row.version !== input.baseVersion) throw new CreatorSaveRejected("conflict", "El recurso cambió en otra ventana. Recarga para ver la última versión.");
  if (input.overwrite) return commitCreatorDoc(row, input.doc, "manual", "Edición manual (sobre otra ventana)", { coalesce: false });
  return commitCreatorDoc(row, input.doc, "manual", "Edición manual");
}

export async function setCreatorStatus(id: number, status: ResourceStatus, errorMessage: string | null = null) {
  const db = await requireDb();
  await db.update(creatorResources).set({ status, errorMessage: errorMessage?.slice(0, 500) ?? null }).where(eq(creatorResources.id, id));
}

export async function addCreatorMessage(input: {
  resourceId: number;
  schoolId: number;
  userId: number;
  role: "user" | "assistant";
  content: string;
  activity?: CreatorActivity[];
  attachments?: CreatorAttachment[];
  turn?: CreatorTurn;
  suggestions?: string[];
  inputTokens?: number;
  outputTokens?: number;
}) {
  const db = await requireDb();
  await db.insert(creatorMessages).values({
    resourceId: input.resourceId,
    schoolId: input.schoolId,
    userId: input.userId,
    role: input.role,
    content: input.content.slice(0, 20_000),
    activity: serializeMessageExtras(input),
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
  });
}

/** Turnos de IA que el usuario ha consumido hoy, para el límite diario. */
export async function countCreatorTurnsToday(actor: AcademicActor): Promise<number> {
  const db = await requireDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(creatorMessages)
    .where(and(eq(creatorMessages.schoolId, actor.schoolId), eq(creatorMessages.userId, actor.userId), eq(creatorMessages.role, "user"), gte(creatorMessages.createdAt, start)));
  return Number(rows[0]?.total ?? 0);
}

export async function renameCreatorResource(actor: AcademicActor, input: { id: number; title: string }) {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, input.id);
  if (row.status === "generating") throw new Error("La IA está trabajando en este recurso. Espera a que termine para editarlo.");
  const doc = { ...parseDoc(row.doc), title: input.title.trim() };
  return commitCreatorDoc(row, doc, "manual", "Título editado");
}

export async function duplicateCreatorResource(actor: AcademicActor, id: number): Promise<{ id: number }> {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, id);
  const doc = parseDoc(row.doc);
  const title = `Copia de ${doc.title || row.title || "recurso"}`.slice(0, CREATOR_LIMITS.titleMax);
  return createCreatorResource(actor, {
    title,
    kind: asKind(row.kind),
    prompt: row.prompt,
    courseLabel: row.courseLabel,
    subjectLabel: row.subjectLabel,
    gradeLabel: row.gradeLabel,
    doc: { ...doc, title },
    status: "ready",
    reason: "manual",
  });
}

export async function deleteCreatorResource(actor: AcademicActor, id: number): Promise<{ id: number }> {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, id);
  const db = await requireDb();
  await db.delete(creatorMessages).where(eq(creatorMessages.resourceId, row.id));
  await db.delete(creatorVersions).where(eq(creatorVersions.resourceId, row.id));
  await db.delete(creatorResources).where(eq(creatorResources.id, row.id));
  await writeAcademicAudit(actor, "creator_deleted", "creator_resource", `${row.id}`);
  return { id: row.id };
}

export interface CreatorVersionSummary {
  id: number;
  version: number;
  reason: VersionReason;
  label: string;
  createdAt: Date;
}

export async function listCreatorVersions(actor: AcademicActor, id: number): Promise<CreatorVersionSummary[]> {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, id);
  const db = await requireDb();
  const rows = await db
    .select({ id: creatorVersions.id, version: creatorVersions.version, reason: creatorVersions.reason, label: creatorVersions.label, createdAt: creatorVersions.createdAt })
    .from(creatorVersions)
    .where(eq(creatorVersions.resourceId, row.id))
    .orderBy(desc(creatorVersions.id))
    .limit(CREATOR_LIMITS.versionsKept);
  return rows.map(version => ({ ...version, reason: version.reason as VersionReason }));
}

/** Restaurar no borra historia: guarda la copia antigua como una versión nueva. */
export async function restoreCreatorVersion(actor: AcademicActor, input: { id: number; versionId: number }) {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, input.id);
  if (row.status === "generating") throw new Error("La IA está trabajando en este recurso. Espera a que termine para restaurar.");
  const db = await requireDb();
  const target = (await db.select().from(creatorVersions).where(and(eq(creatorVersions.id, input.versionId), eq(creatorVersions.resourceId, row.id))).limit(1))[0];
  if (!target) throw new Error("Esa versión ya no existe.");
  const doc = parseDoc(target.doc);
  const saved = await commitCreatorDoc(row, doc, "restore", `Restaurada: ${target.label || "versión anterior"}`);
  return { ...saved, doc };
}

export async function getCreatorSchoolName(schoolId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Institución educativa";
  const row = (await db.select({ name: schools.name }).from(schools).where(eq(schools.id, schoolId)).limit(1))[0];
  return row?.name?.trim() || "Institución educativa";
}

/** Marca el recurso como en proceso y registra lo que pidió el docente, antes de lanzar el turno de IA. */
export async function beginCreatorTurn(actor: AcademicActor, input: { id: number; request: string; blockIds?: string[] }) {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, input.id);
  if (row.status === "generating") throw new Error("La IA ya está trabajando en este recurso.");
  const doc = parseDoc(row.doc);
  // Un bloque señalado que ya no existe no se pasa por alto: la IA trabajaría sobre otra cosa
  const focus = resolveAttachments(doc, input.blockIds ?? []);
  if (!focus.ok) {
    throw new Error(
      focus.missing.length === 1
        ? "Uno de los bloques que adjuntaste ya no está en el recurso. Quítalo del mensaje e inténtalo de nuevo."
        : "Algunos de los bloques que adjuntaste ya no están en el recurso. Quítalos del mensaje e inténtalo de nuevo.",
    );
  }
  const history = await listCreatorMessages(row.id);
  await addCreatorMessage({ resourceId: row.id, schoolId: row.schoolId, userId: actor.userId, role: "user", content: input.request, attachments: focus.attachments });
  await setCreatorStatus(row.id, "generating");
  return { row, doc, history, focusBlockIds: focus.attachments.map(attachment => attachment.id) };
}

/**
 * Deshace un turno de la IA: el recurso vuelve a la versión sobre la que trabajó ese turno, guardada
 * como versión nueva (la que dejó la IA y todo lo posterior siguen en «Versiones»). Si el recurso
 * cambió después del turno no se toca hasta que el docente lo confirme (`force`).
 */
export async function undoCreatorTurn(actor: AcademicActor, input: { id: number; messageId: number; force?: boolean }) {
  assertCreatorActor(actor);
  const row = await loadOwned(actor, input.id);
  if (row.status === "generating") throw new Error("La IA está trabajando en este recurso. Espera a que termine para deshacer.");
  const db = await requireDb();
  const message = (
    await db
      .select({ activity: creatorMessages.activity })
      .from(creatorMessages)
      .where(and(eq(creatorMessages.id, input.messageId), eq(creatorMessages.resourceId, row.id), eq(creatorMessages.role, "assistant")))
      .limit(1)
  )[0];
  const turn = message ? parseMessageExtras(message.activity).turn : undefined;
  if (!turn) throw new Error("Esa respuesta no cambió el recurso.");

  const versions = await db
    .select()
    .from(creatorVersions)
    .where(and(eq(creatorVersions.resourceId, row.id), inArray(creatorVersions.version, [turn.baseVersion, turn.baseVersion + 1])));
  const before = versions.find(version => version.version === turn.baseVersion);
  const after = versions.find(version => version.version === turn.baseVersion + 1);
  const beforeDoc = before ? parseDoc(before.doc) : null;
  if (!beforeDoc || beforeDoc.sections.length === 0) throw new Error("Ya no se conserva el recurso de antes de esa respuesta. Búscalo en «Versiones».");

  const decision = decideTurnUndo({ current: parseDoc(row.doc), before: beforeDoc, after: after ? parseDoc(after.doc) : null, force: input.force });
  if (decision !== "restore") return { status: decision };
  const saved = await commitCreatorDoc(row, beforeDoc, "restore", `Deshecho: ${after?.label || "cambio de la IA"}`);
  return { status: "undone" as const, doc: beforeDoc, version: saved.version };
}

/** Recursos que quedaron "generando" porque el servidor se reinició a mitad de un turno. */
export async function releaseStaleCreatorRuns(activeIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await ensureCreatorTables();
  const stuck = await db.select({ id: creatorResources.id }).from(creatorResources).where(eq(creatorResources.status, "generating"));
  const stale = stuck.map(row => row.id).filter(id => !activeIds.includes(id));
  if (stale.length === 0) return;
  await db
    .update(creatorResources)
    .set({ status: "error", errorMessage: "La generación se interrumpió. Pide el cambio de nuevo en el chat." })
    .where(inArray(creatorResources.id, stale));
}
