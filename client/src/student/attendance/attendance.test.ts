import { describe, expect, it } from "vitest";
import { absenceNote, buildAttendanceModel, utcDay, type RawAttendanceRecord, type RawJustification } from "./attendance";

const utc = (day: number) => new Date(Date.UTC(2026, 10, day));
const record = (id: number, day: number, status: RawAttendanceRecord["status"]): RawAttendanceRecord => ({ id, courseId: "11-2", studentId: "1", attendanceDate: utc(day), status });
const excuse = (id: number, day: number, status: RawJustification["status"], submittedDay = day + 1): RawJustification => ({
  id,
  attendanceDate: utc(day),
  status,
  reasonCategory: "medical",
  description: "Cita médica",
  submittedAt: utc(submittedDay),
});

describe("utcDay", () => {
  it("keeps the registered day in local time (no day shift in UTC−5)", () => {
    const local = utcDay(utc(6));
    expect([local.getFullYear(), local.getMonth(), local.getDate()]).toEqual([2026, 10, 6]);
  });
});

describe("buildAttendanceModel", () => {
  const records = [record(1, 3, "present"), record(2, 4, "late"), record(3, 5, "absent"), record(4, 6, "excused"), record(5, 7, "present")];

  it("counts attendance as present or late over registered days", () => {
    const model = buildAttendanceModel(records, []);
    expect(model).toMatchObject({ registered: 5, present: 2, late: 1, absent: 1, excused: 1, rate: 60 });
    expect(model.days.map(day => day.id)).toEqual([5, 4, 3, 2, 1]);
  });

  it("asks for an excuse only for absences without a live justification", () => {
    expect(buildAttendanceModel(records, []).pendingExcuses.map(day => day.id)).toEqual([3]);
    expect(buildAttendanceModel(records, [excuse(9, 5, "submitted")]).pendingExcuses).toHaveLength(0);
    expect(buildAttendanceModel(records, [excuse(9, 5, "rejected")]).pendingExcuses.map(day => day.id)).toEqual([3]);
  });

  it("links the latest justification to its day and labels it", () => {
    const model = buildAttendanceModel(records, [excuse(8, 5, "rejected", 6), excuse(9, 5, "approved", 8)]);
    const absence = model.days.find(day => day.id === 3)!;
    expect(absence.justification).toMatchObject({ id: 9, statusLabel: "Aprobada", tone: "ok", reasonLabel: "Salud" });
    expect(model.justifications.map(item => item.id)).toEqual([9, 8]);
  });

  it("is honest without records", () => {
    const model = buildAttendanceModel([], []);
    expect(model.rate).toBeNull();
    expect(absenceNote(model)).toBe("Ninguna en el registro");
  });

  it("describes absences for the summary", () => {
    expect(absenceNote(buildAttendanceModel(records, []))).toBe("1 sin excusa");
  });
});
