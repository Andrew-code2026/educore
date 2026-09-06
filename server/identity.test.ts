import { beforeAll, describe, expect, it } from "vitest";
import {
  createGuardianRelationship,
  createSchoolUser,
  ensureIdentitySeeded,
  getDemoIdentityContext,
  getSchoolUserProfile,
  listGuardianStudents,
  listSchoolUsers,
  setUserStatus,
  updateMembershipRole,
  createInvitation,
  acceptInvitation,
} from "./db";
import { DEMO_ROLE_MAP, IDENTITY_ROLES, ROLE_HIERARCHY, ROLE_LABELS, hasPermission, permissionsForRole } from "./identityModel";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const schoolId = 1;
let createdUser: Awaited<ReturnType<typeof createSchoolUser>> = null;
let invitationToken = "";

beforeAll(async () => {
  await ensureIdentitySeeded(schoolId);
  createdUser = await createSchoolUser({
    schoolId,
    firstName: "Prueba",
    lastName: "Identidad",
    email: `prueba.identidad.${Date.now()}@demo.educore.co`,
    roleKey: "TEACHER",
    status: "ACTIVE",
  });
  const admin = await getDemoIdentityContext("admin", schoolId);
  if (admin) {
    const invitation = await createInvitation({ schoolId, email: `aceptar.${Date.now()}@demo.educore.co`, roleKey: "STUDENT", actorUserId: admin.user.id });
    invitationToken = invitation?.rawToken ?? "";
  }
});

describe("EduCore identity catalog", () => {
  it("centralizes the seven production roles", () => {
    expect(IDENTITY_ROLES).toEqual(["SUPER_ADMIN", "SCHOOL_ADMIN", "RECTOR", "COORDINATOR", "TEACHER", "STUDENT", "GUARDIAN"]);
  });

  it("exposes a label for every role", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(7);
    expect(ROLE_LABELS.TEACHER).toBe("Docente");
  });

  it("maps the existing demo views to institutional roles", () => {
    expect(DEMO_ROLE_MAP).toMatchObject({ admin: "SCHOOL_ADMIN", teacher: "TEACHER", student: "STUDENT", guardian: "GUARDIAN" });
  });

  it("gives school admins explicit user creation permission", () => {
    expect(hasPermission("SCHOOL_ADMIN", "users.create")).toBe(true);
    expect(hasPermission("SCHOOL_ADMIN", "users.disable")).toBe(true);
  });

  it("gives teachers grade, attendance and assignment permissions", () => {
    expect(hasPermission("TEACHER", "grades.update")).toBe(true);
    expect(hasPermission("TEACHER", "attendance.update")).toBe(true);
    expect(hasPermission("TEACHER", "assignments.create")).toBe(true);
  });

  it("keeps student permissions limited to learner workflows", () => {
    expect(hasPermission("STUDENT", "assignments.create")).toBe(true);
    expect(hasPermission("STUDENT", "grades.update")).toBe(false);
    expect(hasPermission("STUDENT", "users.view")).toBe(false);
  });

  it("keeps guardian permissions limited to linked student reading", () => {
    expect(hasPermission("GUARDIAN", "reports.view")).toBe(true);
    expect(hasPermission("GUARDIAN", "assignments.create")).toBe(false);
    expect(hasPermission("GUARDIAN", "ai.use")).toBe(false);
  });

  it("keeps hierarchy informational rather than an implicit permission grant", () => {
    expect(ROLE_HIERARCHY.SCHOOL_ADMIN).toBeGreaterThan(ROLE_HIERARCHY.TEACHER);
    expect(hasPermission("RECTOR", "users.disable")).toBe(false);
  });

  it("assigns permission metadata to every key", () => {
    const teacherPermissions = permissionsForRole("TEACHER");
    expect(teacherPermissions.length).toBeGreaterThan(5);
    expect(new Set(teacherPermissions).size).toBe(teacherPermissions.length);
  });
});

describe("EduCore identity persistence and isolation", () => {
  it("derives authorization from ctx.user membership instead of a spoofed role input", async () => {
    const admin = await getDemoIdentityContext("admin", schoolId);
    if (!admin) return;
    const ctx = { user: admin.user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;
    const result = await appRouter.createCaller(ctx).identity.users({ role: "teacher", limit: 5, offset: 0, roleKey: "ALL", status: "ALL" });
    expect(result.total).toBeGreaterThan(0);
  });

  it("does not let a teacher spoof admin privileges through input.role", async () => {
    const teacher = await getDemoIdentityContext("teacher", schoolId);
    if (!teacher) return;
    const ctx = { user: teacher.user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;
    await expect(appRouter.createCaller(ctx).identity.users({ role: "admin", limit: 5, offset: 0, roleKey: "ALL", status: "ALL" })).rejects.toThrow("No tienes permisos");
  });

  it("creates a user and institutional membership", async () => {
    expect(createdUser?.email).toContain("@demo.educore.co");
    expect(createdUser?.membership?.roleKey).toBe("TEACHER");
    expect(createdUser?.membership?.schoolId).toBe(schoolId);
  });

  it("persists a role change through the membership", async () => {
    if (!createdUser) return;
    const updated = await updateMembershipRole({ schoolId, userId: createdUser.id, roleKey: "COORDINATOR" });
    expect(updated?.membership.roleKey).toBe("COORDINATOR");
  });

  it("suspends and reactivates without deleting the profile", async () => {
    if (!createdUser) return;
    const suspended = await setUserStatus({ schoolId, userId: createdUser.id, status: "SUSPENDED" });
    expect(suspended?.status).toBe("SUSPENDED");
    const active = await setUserStatus({ schoolId, userId: createdUser.id, status: "ACTIVE" });
    expect(active?.status).toBe("ACTIVE");
    expect((await getSchoolUserProfile(schoolId, createdUser.id))?.email).toBe(createdUser.email);
  });

  it("creates and accepts an invitation without exposing its token in list results", async () => {
    const invitations = await (await import("./db")).listInvitations(schoolId);
    expect(invitations.every(item => !("tokenHash" in item))).toBe(true);
    if (!invitationToken) return;
    const accepted = await acceptInvitation({ token: invitationToken, firstName: "Invitado", lastName: "Demo" });
    expect(accepted?.membership.roleKey).toBe("STUDENT");
    expect(accepted?.status).toBe("ACTIVE");
  });

  it("creates and reads a guardian-student relationship in one school", async () => {
    const guardian = await getDemoIdentityContext("guardian", schoolId);
    const student = await getDemoIdentityContext("student", schoolId);
    if (!guardian || !student) return;
    const relationship = await createGuardianRelationship({ schoolId, guardianUserId: guardian.user.id, studentUserId: student.user.id, relationshipType: "PARENT", isPrimary: true });
    expect(relationship?.schoolId).toBe(schoolId);
    const linked = await listGuardianStudents(schoolId, guardian.user.id);
    expect(linked.some(item => item.id === student.user.id)).toBe(true);
  });

  it("does not return users from another institution", async () => {
    const otherSchool = await listSchoolUsers({ schoolId: 999999, limit: 50, offset: 0 });
    expect(otherSchool.total).toBe(0);
    expect(otherSchool.rows).toHaveLength(0);
  });

  it("protects the last active school administrator", async () => {
    const admin = await getDemoIdentityContext("admin", schoolId);
    if (!admin) return;
    await expect(setUserStatus({ schoolId, userId: admin.user.id, status: "SUSPENDED" })).rejects.toThrow("último administrador");
  });
});
