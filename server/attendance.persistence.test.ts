import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  listAttendanceRecords: vi.fn(),
  upsertAttendance: vi.fn(),
  listFollowUpCases: vi.fn(),
  createFollowUpCase: vi.fn(),
  getFollowUpHistory: vi.fn(),
  addFollowUpNote: vi.fn(),
  updateFollowUpStatus: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ...dbMocks,
  };
});

import { appRouter } from "./routers";

const createCaller = () => appRouter.createCaller({
  user: null,
  req: {} as never,
  res: {} as never,
});

describe("attendance persistence procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.upsertAttendance.mockResolvedValue(undefined);
    dbMocks.createFollowUpCase.mockResolvedValue({ id: 41, status: "open" });
    dbMocks.getFollowUpHistory.mockResolvedValue({ case: { id: 41, status: "open" }, notes: [] });
    dbMocks.addFollowUpNote.mockResolvedValue({ case: { id: 41, status: "open" }, notes: [{ id: 1 }] });
    dbMocks.updateFollowUpStatus.mockResolvedValue({ case: { id: 41, status: "resolved" }, notes: [] });
  });

  it("persists attendance with the selected course, date, student and actor", async () => {
    const caller = createCaller();
    const attendanceDate = new Date("2026-09-19T00:00:00.000Z");

    await caller.attendance.save({
      records: [{
        courseId: "11-2",
        studentId: "std-1",
        attendanceDate,
        status: "absent",
        reason: "Excusa pendiente",
      }],
    });

    expect(dbMocks.upsertAttendance).toHaveBeenCalledWith([{
      courseId: "11-2",
      studentId: "std-1",
      attendanceDate,
      status: "absent",
      reason: "Excusa pendiente",
      recordedByUserId: null,
      recordedByName: "Juan Diego Loaiza",
    }]);
  });

  it("opens, annotates and changes the status of a follow-up case", async () => {
    const caller = createCaller();

    await caller.followUp.open({
      courseId: "11-2",
      studentId: "std-1",
      reason: "2 ausencias recientes",
      priority: "high",
    });
    await caller.followUp.addNote({ caseId: 41, note: "Se contactó al acudiente." });
    await caller.followUp.updateStatus({ caseId: 41, status: "resolved" });

    expect(dbMocks.createFollowUpCase).toHaveBeenCalledWith({
      courseId: "11-2",
      studentId: "std-1",
      reason: "2 ausencias recientes",
      priority: "high",
      responsibleUserId: null,
      responsibleName: "Juan Diego Loaiza",
    });
    expect(dbMocks.addFollowUpNote).toHaveBeenCalledWith({
      caseId: 41,
      note: "Se contactó al acudiente.",
      authorUserId: null,
      authorName: "Juan Diego Loaiza",
    });
    expect(dbMocks.updateFollowUpStatus).toHaveBeenCalledWith(41, "resolved");
  });
});
