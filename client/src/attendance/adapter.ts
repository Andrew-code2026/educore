/**
 * Adaptador de datos de Asistencia para EduCore Main.
 * Conecta los modelos y servicios reales de EduCore con las interfaces de Manus.
 */

import type {
  AttendanceRecord,
  AttendanceStatus,
  Course,
  SessionStatuses,
  Student,
  StudentSummaryFamilyProfile,
} from "./types";
import type {
  AttendanceCourse as EduAttendanceCourse,
  AttendanceStudent as EduAttendanceStudent,
} from "@/components/attendance/types";
import { toISODate, toUtcDateIso } from "./data/dateUtils";

// Plantillas de contexto institucional para cursos de EduCore
const COURSE_METADATA: Record<
  string,
  { subject: string; room: string; start: string; end: string; classDays: number[]; color: string }
> = {
  "11-2": {
    subject: "Biología",
    room: "Laboratorio de Ciencias",
    start: "07:00",
    end: "08:30",
    classDays: [1, 2, 3, 4, 5],
    color: "from-blue-600 to-indigo-600",
  },
  "11-1": {
    subject: "Biología",
    room: "Laboratorio de Biología",
    start: "10:00",
    end: "11:30",
    classDays: [1, 2, 3, 4, 5],
    color: "from-emerald-600 to-teal-600",
  },
};

/** Normaliza estados de asistencia de EduCore a los tokens de Manus */
export function normalizeAttendanceStatus(rawStatus?: string | null): AttendanceStatus {
  if (!rawStatus) return "pending";
  const lower = rawStatus.toLowerCase().trim();
  if (lower === "present" || lower === "presente") return "present";
  if (lower === "absent" || lower === "ausente") return "absent";
  if (lower === "late" || lower === "tardanza" || lower === "tarde") return "late";
  if (lower === "excuse" || lower === "excused" || lower === "excusa") return "excuse";
  return "pending";
}

/** Extrae iniciales a partir del nombre completo */
export function extractInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ED";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Descompone nombre en nombre y apellido */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: fullName, lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export interface AttendanceAdapterOptions {
  snapshotData: any;
  realAttendanceRecords?: any[];
  justifications?: any[];
  followUpCases?: any[];
}

/**
 * Transforma los datos de EduCore al contrato tipado de Manus.
 */
export function adaptEduCoreDataToManus({
  snapshotData,
  realAttendanceRecords = [],
  justifications = [],
  followUpCases = [],
}: AttendanceAdapterOptions): {
  courses: Course[];
  todayStatuses: SessionStatuses;
  /** Estados de la jornada de hoy separados por curso (un estudiante puede estar en varios). */
  todayStatusesByCourse: Record<string, SessionStatuses>;
  statusesByDate: Record<string, SessionStatuses>;
  eduStudentMap: Map<string, EduAttendanceStudent>;
  eduCourseMap: Map<string, EduAttendanceCourse>;
  recordsByStudentDate: Map<string, AttendanceStatus>;
} {
  const rawCourses = snapshotData?.courses ?? [];
  const rawStudents = snapshotData?.students ?? [];
  const snapshotAttendance = snapshotData?.attendance ?? [];

  const todayIso = toISODate(new Date());

  // Mapa de justificaciones pendientes por estudiante
  const pendingJustificationsByStudent = new Map<string, number>();
  for (const j of justifications) {
    if (j.status === "pending" || j.status === "in_review") {
      const sId = String(j.studentId);
      pendingJustificationsByStudent.set(sId, (pendingJustificationsByStudent.get(sId) || 0) + 1);
    }
  }

  // Mapa de solicitudes/casos de seguimiento abiertos por estudiante
  const pendingCasesByStudent = new Map<string, number>();
  for (const c of followUpCases) {
    if (c.status !== "resolved") {
      const sId = String(c.studentId);
      pendingCasesByStudent.set(sId, (pendingCasesByStudent.get(sId) || 0) + 1);
    }
  }

  // Mapa consolidado de registros de asistencia: `courseId:studentId:date` -> status
  const recordsMap = new Map<string, AttendanceStatus>();
  const recordsByStudentDate = new Map<string, AttendanceStatus>();

  // 1. Cargar desde snapshotAttendance (records históricos precargados)
  for (const att of snapshotAttendance) {
    if (!att.date || !att.studentName || !att.course) continue;
    const dateStr = toUtcDateIso(att.date);
    if (dateStr) {
      // Buscar estudiante por nombre
      const matchedStudent = rawStudents.find(
        (s: any) => s.name.toLowerCase() === att.studentName.toLowerCase()
      );
      if (matchedStudent) {
        const key = `${att.course}:${matchedStudent.id}:${dateStr}`;
        const status = normalizeAttendanceStatus(att.status);
        recordsMap.set(key, status);
        recordsByStudentDate.set(`${matchedStudent.id}:${dateStr}`, status);
      }
    }
  }

  // 2. Sobrescribir con registros reales de base de datos (tRPC attendance.list)
  for (const rec of realAttendanceRecords) {
    const dateStr = toUtcDateIso(rec.attendanceDate);
    if (dateStr && rec.studentId && rec.courseId) {
      const key = `${rec.courseId}:${rec.studentId}:${dateStr}`;
      const status = normalizeAttendanceStatus(rec.status);
      recordsMap.set(key, status);
      recordsByStudentDate.set(`${rec.studentId}:${dateStr}`, status);
    }
  }

  // Determinar los nombres de los cursos a desplegar
  const courseNames: string[] = [];
  rawCourses.forEach((c: any) => {
    if (c.name && !courseNames.includes(c.name)) {
      courseNames.push(c.name);
    }
  });

  const eduStudentMap = new Map<string, EduAttendanceStudent>();
  const eduCourseMap = new Map<string, EduAttendanceCourse>();
  const statusesByDate: Record<string, SessionStatuses> = {};
  const todayStatuses: SessionStatuses = {};
  const todayStatusesByCourse: Record<string, SessionStatuses> = {};

  const courses: Course[] = courseNames.map((courseName, cIdx) => {
    const meta =
      COURSE_METADATA[courseName] ?? {
        subject: "Biología",
        room: `Aula ${100 + cIdx}`,
        start: "08:00",
        end: "09:30",
        classDays: [1, 2, 3, 4, 5],
        color: "from-slate-600 to-indigo-600",
      };

    const courseTodayStatuses: SessionStatuses = {};
    todayStatusesByCourse[courseName] = courseTodayStatuses;

    const matchedStudents = rawStudents.filter((s: any) => s.course === courseName);

    const students: Student[] = matchedStudents.map((s: any, sIdx: number) => {
      const studentIdStr = String(s.id);
      const { firstName, lastName } = splitName(s.name || `Estudiante ${sIdx + 1}`);
      const initials = extractInitials(s.name || `E${sIdx + 1}`);

      // Construir histórico de asistencia del estudiante
      const history: AttendanceRecord[] = [];
      // Buscar todos los registros en recordsMap para este estudiante y curso
      const prefix = `${courseName}:${studentIdStr}:`;
      const studentDates: string[] = [];

      for (const [key, status] of recordsMap.entries()) {
        if (key.startsWith(prefix)) {
          const recordDate = key.slice(prefix.length);
          if (recordDate !== todayIso) {
            studentDates.push(recordDate);
            history.push({ date: recordDate, status });
          } else {
            todayStatuses[studentIdStr] = status;
            courseTodayStatuses[studentIdStr] = status;
          }
        }
      }

      // Ordenar cronológicamente (más antiguo al más reciente)
      history.sort((a, b) => a.date.localeCompare(b.date));

      // Guardar también el estado de hoy en todayStatuses si ya existe
      const todayKey = `${courseName}:${studentIdStr}:${todayIso}`;
      if (recordsMap.has(todayKey)) {
        todayStatuses[studentIdStr] = recordsMap.get(todayKey)!;
      }

      const pendingExcuses = pendingJustificationsByStudent.get(studentIdStr) || 0;
      const pendingRequests = pendingCasesByStudent.get(studentIdStr) || 0;

      // Calcular tasa acumulada para el objeto EduAttendanceStudent
      const recorded = history.filter((h) => h.status !== "pending");
      const attended = recorded.filter((h) => h.status === "present" || h.status === "late").length;
      const rate = recorded.length > 0 ? Math.round((attended / recorded.length) * 100) : 94;
      const absencesCount = history.filter((h) => h.status === "absent").length;

      // Guardar en eduStudentMap para Expediente 360
      const eduStudent: EduAttendanceStudent = {
        id: studentIdStr,
        numericId: s.id,
        name: s.name,
        code: s.studentCode || `EST-${courseName}-${String(sIdx + 1).padStart(2, "0")}`,
        course: courseName,
        gradeLevel: s.gradeLevel || "11°",
        academicStatus: s.status || "Activo",
        avatar: s.avatarUrl,
        avatarColor: s.avatarColor || (sIdx % 2 === 0 ? "#dbeafe" : "#fef3c7"),
        email: s.email,
        // Sin datos reales se deja vacío: el expediente no debe mostrar contactos inventados.
        guardianName: s.guardianName || undefined,
        guardianPhone: s.guardianPhone || s.phone || undefined,
        guardianEmail: s.guardianEmail || s.email,
        attendanceRate: rate,
        absencesCount,
      };
      eduStudentMap.set(studentIdStr, eduStudent);

      return {
        id: studentIdStr,
        firstName,
        lastName,
        fullName: s.name || `Estudiante ${sIdx + 1}`,
        initials,
        group: courseName,
        courseId: courseName,
        history,
        pendingExcuses,
        pendingRequests,
        guardian: s.guardianName,
      };
    });

    const eduCourse: EduAttendanceCourse = {
      id: courseName,
      label: courseName,
      subject: meta.subject,
      room: meta.room,
      time: `${meta.start} – ${meta.end}`,
      color: meta.color,
      students: students.map((st) => eduStudentMap.get(st.id)!),
      teacherName: snapshotData?.user?.name || undefined,
    };
    eduCourseMap.set(courseName, eduCourse);

    return {
      id: courseName,
      name: courseName,
      grade: courseName.includes("11") ? "11°" : "10°",
      subject: meta.subject,
      room: meta.room,
      classDays: meta.classDays,
      start: meta.start,
      end: meta.end,
      students,
    };
  });

  return {
    courses,
    todayStatuses,
    todayStatusesByCourse,
    statusesByDate,
    eduStudentMap,
    eduCourseMap,
    recordsByStudentDate,
  };
}

/** Convierte Manus Student a StudentSummaryFamilyProfile para la tarjeta de resumen */
export function getStudentSummaryFamilyProfile(
  student: Student,
  eduStudentMap: Map<string, EduAttendanceStudent>
): StudentSummaryFamilyProfile | undefined {
  const eduStudent = eduStudentMap.get(student.id);
  if (!eduStudent) return undefined;
  return {
    studentCode: eduStudent.code,
    guardianPhone: eduStudent.guardianPhone,
    guardianEmail: eduStudent.guardianEmail,
  };
}
