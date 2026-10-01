import React from "react";
import {
  AttendanceCourse,
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  JUSTIFICATION_REASON_LABELS,
  JUSTIFICATION_STATUS_META,
  STATUS_META,
  StudentTimelineItem,
} from "./types";
import { analyzeStudentPattern, calculateHistoryStats } from "./intelligence";

export interface StudentDossierPrintViewProps {
  student: AttendanceStudent;
  course: AttendanceCourse;
  periodStats: ReturnType<typeof calculateHistoryStats>;
  patternAnalysis: ReturnType<typeof analyzeStudentPattern>;
  studentJustifications: AttendanceJustificationItem[];
  studentActiveCase?: AttendanceFollowUpCaseItem;
  resolvedCases: AttendanceFollowUpCaseItem[];
  currentCaseNotes: AttendanceFollowUpNoteItem[];
  unifiedTimeline: StudentTimelineItem[];
  days: AttendanceDay[];
  getStatus: (studentId: string, date: string) => AttendanceStatus;
  academicPeriod?: string;
  generationDate?: Date;
  schoolLogoUrl?: string;
  schoolName?: string;
}

export const StudentDossierPrintView: React.FC<StudentDossierPrintViewProps> = ({
  student,
  course,
  periodStats,
  patternAnalysis,
  studentJustifications,
  studentActiveCase,
  resolvedCases,
  currentCaseNotes,
  unifiedTimeline,
  days,
  getStatus,
  academicPeriod = "Año Lectivo 2026 · Período 2",
  generationDate = new Date(),
  schoolLogoUrl,
  schoolName = "EduCore · Plataforma Educativa Institucional",
}) => {
  // Formateador de fecha institucional
  const formattedGenerationDate = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(generationDate);

  // Filtrado de novedades de asistencia (ausencias, tardanzas y justificadas)
  const attendanceNovelties = React.useMemo(() => {
    const novelties: {
      date: string;
      label: string;
      status: AttendanceStatus;
    }[] = [];

    days.forEach((day) => {
      const st = getStatus(student.id, day.iso);
      if (st === "absent" || st === "late" || st === "excused") {
        novelties.push({
          date: day.iso,
          label: day.label,
          status: st,
        });
      }
    });

    return novelties;
  }, [days, student.id, getStatus]);

  // Folio institucional
  const folioCode = `EXP-${student.code || student.id.slice(0, 6).toUpperCase()}-2026`;

  return (
    <div
      id="student-dossier-print-container"
      className="student-dossier-print-root w-full max-w-[210mm] mx-auto bg-white text-slate-900 font-sans p-6 sm:p-8"
      style={{
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* ===================================================================== */}
      {/* 1. ENCABEZADO INSTITUCIONAL                                            */}
      {/* ===================================================================== */}
      <header className="border-b-2 border-slate-900 pb-4 mb-5 break-inside-avoid">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Escudo / Isotipo institucional */}
            {schoolLogoUrl ? (
              <img
                src={schoolLogoUrl}
                alt="Escudo"
                className="w-12 h-12 rounded-xl object-contain shrink-0 border border-slate-200 bg-white p-1"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl tracking-tighter shrink-0">
                ED
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block">
                {schoolName}
              </span>
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                EXPEDIENTE INTEGRAL DE ASISTENCIA DEL ESTUDIANTE
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Ficha Oficial de Monitoreo, Convivencia y Control Escolar
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800">
              Folio: {folioCode}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Emisión: {formattedGenerationDate}
            </p>
            <p className="text-[10px] font-semibold text-slate-700">
              {academicPeriod}
            </p>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. IDENTIFICACIÓN DEL ESTUDIANTE Y ACUDIENTE                          */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid border border-slate-300 rounded-lg p-3.5 bg-slate-50/50">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2.5 border-b border-slate-200 pb-1 flex items-center justify-between">
          <span>1. Identificación del Estudiante</span>
          <span className="text-slate-500 font-normal">
            Curso: {course.label} ({course.subject})
          </span>
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Nombre Completo:
            </span>
            <span className="font-bold text-slate-900 text-sm">{student.name}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Código / Matrícula:
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {student.code || student.id}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Curso / Grado:
            </span>
            <span className="font-medium text-slate-800">
              {student.course || course.label}{" "}
              {student.gradeLevel ? `· ${student.gradeLevel}` : ""}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Estado en Matrícula:
            </span>
            <span className="font-semibold text-slate-800">
              {student.academicStatus || "Activo Regular"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Padre / Madre / Acudiente:
            </span>
            <span className="font-medium text-slate-800">
              {student.guardianName || "No registrado"}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              Contacto Acudiente:
            </span>
            <span className="text-slate-700">
              {student.guardianPhone ? `Tel: ${student.guardianPhone}` : "Sin teléfono"}
              {student.guardianEmail ? ` · ${student.guardianEmail}` : ""}
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. RESUMEN DE ASISTENCIA Y RENDIMIENTO                                */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          2. Resumen Factual de Asistencia en el Período
        </h2>

        <div className="grid grid-cols-6 gap-2 text-center">
          <div className="border border-slate-300 rounded p-2 bg-slate-50">
            <span className="block text-[10px] text-slate-600 font-bold uppercase">
              Asistencia
            </span>
            <span
              className={`text-xl font-black ${
                periodStats.attendanceRate >= 90
                  ? "text-emerald-700"
                  : periodStats.attendanceRate >= 80
                  ? "text-amber-700"
                  : "text-rose-700"
              }`}
            >
              {periodStats.attendanceRate}%
            </span>
          </div>

          <div className="border border-slate-200 rounded p-2">
            <span className="block text-[10px] text-slate-500 uppercase">
              Evaluadas
            </span>
            <span className="text-lg font-bold text-slate-800">
              {periodStats.recordedDays} / {periodStats.totalDays}
            </span>
          </div>

          <div className="border border-slate-200 rounded p-2 bg-emerald-50/40">
            <span className="block text-[10px] text-emerald-800 font-semibold uppercase">
              Presentes
            </span>
            <span className="text-lg font-bold text-emerald-700">
              {periodStats.presentCount}
            </span>
          </div>

          <div className="border border-slate-200 rounded p-2 bg-rose-50/40">
            <span className="block text-[10px] text-rose-800 font-semibold uppercase">
              Ausencias
            </span>
            <span className="text-lg font-bold text-rose-700">
              {periodStats.absentCount}
            </span>
          </div>

          <div className="border border-slate-200 rounded p-2 bg-amber-50/40">
            <span className="block text-[10px] text-amber-800 font-semibold uppercase">
              Tardanzas
            </span>
            <span className="text-lg font-bold text-amber-700">
              {periodStats.lateCount}
            </span>
          </div>

          <div className="border border-slate-200 rounded p-2 bg-blue-50/40">
            <span className="block text-[10px] text-blue-800 font-semibold uppercase">
              Excusas
            </span>
            <span className="text-lg font-bold text-blue-700">
              {periodStats.excusedCount}
            </span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. ANÁLISIS FACTUAL DEL PERÍODO Y ALERTAS                             */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1 flex items-center justify-between">
          <span>3. Diagnóstico y Análisis del Período</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              patternAnalysis.severity === "critical"
                ? "bg-rose-100 text-rose-800 border border-rose-300"
                : patternAnalysis.severity === "preventive"
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
            }`}
          >
            Nivel de Riesgo:{" "}
            {patternAnalysis.severity === "critical"
              ? "CRÍTICO"
              : patternAnalysis.severity === "preventive"
              ? "PRECAUCIÓN"
              : "NORMAL"}
          </span>
        </h2>

        {patternAnalysis.hasNegativePattern ? (
          <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
              <span>• {patternAnalysis.headline}</span>
              <span className="text-[10px] uppercase font-semibold text-slate-500">
                Severidad: {patternAnalysis.severity === "critical" ? "Alta" : "Media"}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed pl-3 border-l-2 border-slate-300">
              {patternAnalysis.explanation}
            </p>
            {patternAnalysis.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {patternAnalysis.badges.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-300 text-slate-700"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 rounded p-3 text-xs text-slate-600 bg-slate-50/30">
            El estudiante presenta una asistencia regular sin patrones recurrentes de inasistencia ni alertas de riesgo en el período evaluado.
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 5. NOVEDADES DE ASISTENCIA (Inasistencias y Tardanzas cronológicas)     */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          4. Registro Cronológico de Novedades de Asistencia
        </h2>

        {attendanceNovelties.length > 0 ? (
          <table className="w-full text-left text-xs border border-slate-300 rounded border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                <th className="p-1.5 font-bold">Fecha</th>
                <th className="p-1.5 font-bold">Día</th>
                <th className="p-1.5 font-bold">Novedad Registrada</th>
                <th className="p-1.5 font-bold">Asignatura / Sesión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attendanceNovelties.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-1.5 font-mono text-slate-800">{item.date}</td>
                  <td className="p-1.5 text-slate-700">{item.label}</td>
                  <td className="p-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === "absent"
                          ? "bg-rose-100 text-rose-800"
                          : item.status === "late"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {STATUS_META[item.status]?.label || item.status}
                    </span>
                  </td>
                  <td className="p-1.5 text-slate-600">
                    {course.label} ({course.subject})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="border border-slate-200 rounded p-3 text-xs text-slate-600 bg-slate-50/30">
            No se registran novedades de inasistencia, tardanzas o ausencias justificadas en las sesiones evaluadas.
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 6. HISTORIAL DE EXCUSAS Y JUSTIFICACIONES                             */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          5. Excusas y Justificaciones Radicadas
        </h2>

        {studentJustifications.length > 0 ? (
          <div className="space-y-2.5">
            {studentJustifications.map((just) => (
              <div
                key={just.id}
                className="border border-slate-300 rounded p-2.5 text-xs bg-slate-50/30 break-inside-avoid"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-1.5">
                  <span className="font-bold text-slate-900">
                    Folio #{just.id} · Fecha de falta: {just.attendanceDate}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      just.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : just.status === "rejected" || just.status === "unjustified"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-blue-100 text-blue-800 border border-blue-300"
                    }`}
                  >
                    Estado: {JUSTIFICATION_STATUS_META[just.status]?.label || just.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 mb-1.5">
                  <div>
                    <span className="font-semibold text-slate-500">Motivo: </span>
                    {JUSTIFICATION_REASON_LABELS[just.reasonCategory] || just.reasonCategory}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Radicado por: </span>
                    {just.submittedByName} (
                    {just.submittedByRole === "guardian" ? "Acudiente" : "Estudiante"})
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Fecha de radicación: </span>
                    {just.submittedAt ? new Date(just.submittedAt).toLocaleDateString("es-CO") : just.attendanceDate}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Soporte documental: </span>
                    {just.digitalEvidenceUrl ? (
                      <span className="font-medium text-slate-800">
                        Consta adjunto digital ({just.digitalEvidenceName || "Documento acreditado"})
                      </span>
                    ) : just.physicalSupportReceivedAt ? (
                      <span className="font-medium text-indigo-800">
                        Soporte físico original verificado ({just.physicalSupportReceivedByName || "Secretaría"})
                      </span>
                    ) : just.requiresPhysicalSupport ? (
                      <span className="text-amber-800 font-medium">
                        Pendiente de entrega de soporte físico
                      </span>
                    ) : (
                      <span className="text-slate-500">Sin archivo adjunto</span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-800 bg-white border border-slate-200 rounded p-1.5">
                  <span className="font-semibold text-slate-600">Descripción: </span>
                  {just.description || "Sin descripción adicional."}
                </p>

                {just.resolutionNotes && (
                  <p className="text-[11px] text-slate-700 mt-1.5 pl-2 border-l-2 border-slate-400">
                    <span className="font-semibold">Resolución docente/coordinación: </span>
                    {just.resolutionNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-slate-200 rounded p-3 text-xs text-slate-600 bg-slate-50/30">
            No se registran solicitudes de justificación ni excusas radicadas en el período.
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 7. SEGUIMIENTO PEDAGÓGICO Y CASOS DE CONVIVENCIA                       */}
      {/* ===================================================================== */}
      <section className="mb-5 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          6. Seguimiento Pedagógico y Acompañamiento
        </h2>

        {studentActiveCase ? (
          <div className="border border-slate-300 rounded p-3 bg-slate-50/40 text-xs mb-3 break-inside-avoid">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
              <span className="font-bold text-slate-900">
                Caso Activo #CASO-{studentActiveCase.id} · Prioridad{" "}
                {studentActiveCase.priority === "high"
                  ? "Alta"
                  : studentActiveCase.priority === "medium"
                  ? "Media"
                  : "Baja"}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                {studentActiveCase.status === "open" ? "Abierto" : "En revisión"}
              </span>
            </div>

            <p className="mb-2 text-slate-800">
              <span className="font-semibold text-slate-600">Motivo del caso: </span>
              {studentActiveCase.reason}
            </p>

            <div className="text-[11px] text-slate-500 mb-2">
              Iniciado el{" "}
              {new Date(studentActiveCase.createdAt).toLocaleDateString("es-CO")} por{" "}
              <span className="font-medium text-slate-700">
                {studentActiveCase.responsibleName}
              </span>
            </div>

            {/* Acuerdos docentes y notas de seguimiento */}
            {currentCaseNotes.length > 0 ? (
              <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-600 block">
                  Acuerdos y notas docentes registradas:
                </span>
                {currentCaseNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-1.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span className="font-semibold text-slate-800">
                        {note.authorName}
                      </span>
                      <span>
                        {new Date(note.createdAt).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                    <p>{note.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic mt-1">
                Sin notas docentes ni compromisos registrados en este caso.
              </p>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 rounded p-3 text-xs text-slate-600 bg-slate-50/30 mb-3">
            No registra casos de acompañamiento pedagógico actualmente abiertos.
          </div>
        )}

        {/* Antecedentes resueltos */}
        {resolvedCases.length > 0 && (
          <div className="border border-slate-200 rounded p-2.5 bg-slate-50/20 text-xs break-inside-avoid">
            <span className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
              Antecedentes pedagógicos resueltos ({resolvedCases.length}):
            </span>
            <ul className="space-y-1 text-[11px] text-slate-700">
              {resolvedCases.map((rc) => (
                <li key={rc.id} className="flex items-center justify-between">
                  <span>
                    • Caso #{rc.id}: {rc.reason}
                  </span>
                  <span className="text-slate-500">
                    Resuelto el{" "}
                    {rc.resolvedAt
                      ? new Date(rc.resolvedAt).toLocaleDateString("es-CO")
                      : "Archivo"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 8. LÍNEA DE TIEMPO RESUMIDA                                           */}
      {/* ===================================================================== */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase mb-2 border-b border-slate-200 pb-1">
          7. Hitos Cronológicos Destacados
        </h2>

        {unifiedTimeline.length > 0 ? (
          <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
            {unifiedTimeline.slice(0, 10).map((event) => (
              <div key={event.id} className="p-2 flex items-start gap-3">
                <span className="font-mono text-[10px] text-slate-500 shrink-0 w-20">
                  {event.date}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-[11px]">
                      {event.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({event.actorName || event.actorRole})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-slate-200 rounded p-3 text-xs text-slate-600 bg-slate-50/30">
            Sin eventos registrados en la línea de tiempo.
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 9. FIRMAS DE CONFORMIDAD INSTITUCIONAL                                */}
      {/* ===================================================================== */}
      <footer className="mt-8 pt-4 border-t-2 border-slate-300 break-inside-avoid">
        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider text-center mb-8">
          Constancia de revisión y verificación institucional
        </div>

        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          {/* Firma Docente */}
          <div className="break-inside-avoid">
            <div className="border-b border-slate-400 h-14 mb-1.5" />
            <span className="font-bold text-slate-900 block text-xs">
              {course.teacherName || "Juan Diego Loaiza"}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Docente Responsable · {course.label} ({course.subject})
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Firma y Documento de Identidad
            </span>
          </div>

          {/* Firma Coordinación */}
          <div className="break-inside-avoid">
            <div className="border-b border-slate-400 h-14 mb-1.5" />
            <span className="font-bold text-slate-900 block text-xs">
              Coordinación Académica / Convivencia
            </span>
            <span className="text-[10px] text-slate-500 block">
              Sello y Visto Bueno
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Firma Autorizada
            </span>
          </div>

          {/* Firma Acudiente */}
          <div className="break-inside-avoid">
            <div className="border-b border-slate-400 h-14 mb-1.5" />
            <span className="font-bold text-slate-900 block text-xs">
              Padre / Madre / Acudiente
            </span>
            <span className="text-[10px] text-slate-500 block">
              {student.guardianName || "Nombre del acudiente"}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Cédula / Documento de Identidad
            </span>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400">
          Documento oficial generado desde EduCore · Expediente Integral del Estudiante · Prohibida su alteración sin autorización institucional · Página 1 de 1 (Ficha A4)
        </div>
      </footer>
    </div>
  );
};

export default StudentDossierPrintView;
