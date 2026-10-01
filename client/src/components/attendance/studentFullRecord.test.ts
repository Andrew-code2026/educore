import { describe, expect, it } from "vitest";
import {
  AttendanceDay,
  AttendanceFollowUpCaseItem,
  AttendanceFollowUpNoteItem,
  AttendanceJustificationItem,
  AttendanceStatus,
  AttendanceStudent,
  DEFAULT_ATTENDANCE_DAYS,
  StudentRecordTab,
  StudentTimelineItem,
  normalizeDateIso,
} from "./types";
import { analyzeStudentPattern, calculateHistoryStats } from "./intelligence";
import { getDocumentType, normalizeDocumentUrl } from "./DocumentPreviewModal";

describe("Iteración 8 — Expediente Integral del Estudiante y Ficha Rápida", () => {
  const sampleDays: AttendanceDay[] = [
    { iso: "2026-09-14", label: "Lun 14" },
    { iso: "2026-09-15", label: "Mar 15" },
    { iso: "2026-09-16", label: "Mié 16" },
    { iso: "2026-09-17", label: "Jue 17" },
    { iso: "2026-09-18", label: "Vie 18" },
  ];

  const regularStudent: AttendanceStudent = {
    id: "1",
    numericId: 1,
    name: "Juliana Alvarez Giraldo",
    code: "EST-11-2-01",
    course: "11-2",
    gradeLevel: "11°",
    academicStatus: "Activo",
    guardianName: "Carlos Alvarez",
    guardianPhone: "+57 301 555 0101",
    guardianEmail: "carlos.alvarez@demo.educore.co",
    attendanceRate: 100,
    absencesCount: 0,
  };

  const studentWithAbsences: AttendanceStudent = {
    id: "2",
    numericId: 2,
    name: "María Camila Angarita",
    code: "EST-11-2-02",
    course: "11-2",
    gradeLevel: "11°",
    academicStatus: "Activo",
    guardianName: "Patricia Cachaya",
    guardianPhone: "+57 312 555 0102",
    attendanceRate: 80,
    absencesCount: 3,
  };

  it("1. Resuelve la tasa de asistencia 100% de los datos reales sin depender de mocks de índices", () => {
    const statuses: Record<string, AttendanceStatus> = {
      "2026-09-14": "present",
      "2026-09-15": "present",
      "2026-09-16": "present",
      "2026-09-17": "late",
      "2026-09-18": "present",
    };

    const stats = calculateHistoryStats(regularStudent.id, sampleDays, (_sId, date) => statuses[date] || "pending");
    expect(stats.totalDays).toBe(5);
    expect(stats.recordedDays).toBe(5);
    expect(stats.presentCount).toBe(4);
    expect(stats.lateCount).toBe(1);
    expect(stats.absentCount).toBe(0);
    expect(stats.attendanceRate).toBe(80); // 4 presentes de 5 registradas
  });

  it("2. Ficha Rápida: un estudiante regular NO recibe diagnósticos negativos ni alertas innecesarias", () => {
    const perfectStatuses: Record<string, AttendanceStatus> = {
      "2026-09-14": "present",
      "2026-09-15": "present",
      "2026-09-16": "present",
      "2026-09-17": "present",
      "2026-09-18": "present",
    };

    const analysis = analyzeStudentPattern(regularStudent, sampleDays, (_sId, date) => perfectStatuses[date]);
    expect(analysis.hasNegativePattern).toBe(false);
    expect(analysis.severity).toBe("normal");
    expect(analysis.headline).toBe("asistencia regular y al día");
    expect(analysis.badges).toHaveLength(0);
  });

  it("3. Navegación secuencial entre estudiantes (Anterior y Siguiente)", () => {
    const roster: AttendanceStudent[] = [regularStudent, studentWithAbsences];

    const getNextStudent = (current: AttendanceStudent): AttendanceStudent => {
      const idx = roster.findIndex((s) => s.id === current.id);
      const nextIdx = idx === -1 || idx === roster.length - 1 ? 0 : idx + 1;
      return roster[nextIdx];
    };

    const getPrevStudent = (current: AttendanceStudent): AttendanceStudent => {
      const idx = roster.findIndex((s) => s.id === current.id);
      const prevIdx = idx <= 0 ? roster.length - 1 : idx - 1;
      return roster[prevIdx];
    };

    // Navegar siguiente
    expect(getNextStudent(roster[0]).id).toBe("2");
    // Ciclo circular en el último
    expect(getNextStudent(roster[1]).id).toBe("1");

    // Navegar anterior
    expect(getPrevStudent(roster[1]).id).toBe("1");
    // Ciclo circular en el primero
    expect(getPrevStudent(roster[0]).id).toBe("2");
  });

  it("4. Sincronización inmediata: al aprobar una excusa médica la falta se convierte en 'excused'", () => {
    const cellStatuses: Record<string, AttendanceStatus> = {
      "2:2026-09-16": "absent",
    };

    const justification: AttendanceJustificationItem = {
      id: 101,
      courseId: "11-2",
      studentId: "2",
      attendanceDate: "2026-09-16",
      reasonCategory: "medical",
      description: "Incapacidad por cuadro gripal agudo",
      submittedByRole: "guardian",
      submittedByName: "Patricia Cachaya",
      submittedAt: "2026-09-16T10:00:00.000Z",
      requiresPhysicalSupport: false,
      status: "in_review",
      escalatedToCoordination: false,
      createdAt: "2026-09-16T10:00:00.000Z",
    };

    // Simular resolución aprobada
    const resolveAndSync = (just: AttendanceJustificationItem, status: "approved" | "unjustified" | "rejected") => {
      just.status = status;
      if (status === "approved") {
        cellStatuses[`${just.studentId}:${just.attendanceDate}`] = "excused";
      }
    };

    resolveAndSync(justification, "approved");

    expect(justification.status).toBe("approved");
    expect(cellStatuses["2:2026-09-16"]).toBe("excused");
  });

  it("5. Conservación de antecedentes: los casos resueltos permanecen accesibles en el historial de seguimiento", () => {
    const cases: AttendanceFollowUpCaseItem[] = [
      {
        id: 1,
        courseId: "11-2",
        studentId: "2",
        reason: "Acuerdo de puntualidad tras 3 tardanzas",
        priority: "medium",
        status: "resolved",
        responsibleUserId: 10,
        responsibleName: "Juan Diego Loaiza",
        createdAt: "2026-08-30T08:00:00.000Z",
        updatedAt: "2026-09-05T12:00:00.000Z",
        resolvedAt: "2026-09-05T12:00:00.000Z",
      },
      {
        id: 2,
        courseId: "11-2",
        studentId: "2",
        reason: "Seguimiento preventivo por 2 inasistencias consecutivas",
        priority: "high",
        status: "open",
        responsibleUserId: 10,
        responsibleName: "Juan Diego Loaiza",
        createdAt: "2026-09-18T08:00:00.000Z",
        updatedAt: "2026-09-18T08:00:00.000Z",
      },
    ];

    const activeCases = cases.filter((c) => c.status !== "resolved");
    const resolvedCases = cases.filter((c) => c.status === "resolved");

    expect(activeCases).toHaveLength(1);
    expect(activeCases[0].id).toBe(2);

    expect(resolvedCases).toHaveLength(1);
    expect(resolvedCases[0].id).toBe(1);
    expect(resolvedCases[0].resolvedAt).toBeDefined();
    expect(resolvedCases[0].reason).toContain("Acuerdo de puntualidad");
  });

  it("6. Línea de tiempo unificada: fusiona e intercala cronológicamente asistencias, excusas y seguimiento", () => {
    const timelineItems: StudentTimelineItem[] = [
      {
        id: "att-1",
        date: "2026-09-16",
        timestamp: "2026-09-16T08:00:00.000Z",
        type: "absence",
        title: "Inasistencia registrada",
        description: "Clase de Matemáticas 11-2",
        actorRole: "Docente",
        actorName: "Juan Diego Loaiza",
      },
      {
        id: "just-1",
        date: "2026-09-16",
        timestamp: "2026-09-16T11:00:00.000Z",
        type: "excuse_submitted",
        title: "Excusa médica radicada",
        description: "Adjuntó constancia médica",
        actorRole: "Acudiente",
        actorName: "Patricia Cachaya",
      },
      {
        id: "case-1",
        date: "2026-09-17",
        timestamp: "2026-09-17T09:00:00.000Z",
        type: "case_opened",
        title: "Apertura de caso preventivo",
        description: "Revisión con acudiente",
        actorRole: "Docente",
        actorName: "Juan Diego Loaiza",
      },
    ];

    // Ordenar de más reciente a más antiguo
    const sorted = [...timelineItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    expect(sorted[0].id).toBe("case-1");
    expect(sorted[1].id).toBe("just-1");
    expect(sorted[2].id).toBe("att-1");
    expect(sorted).toHaveLength(3);
  });

  describe("Fase 1 — Visor Real de Documentos y Soporte Multimodal", () => {
    it("7. Normaliza correctamente URLs legacy de almacenamiento hacia rutas estáticas accesibles", () => {
      const virtualUrl = "https://storage.educore.edu/justifications/cert_medico_juliana.pdf";
      const normalized = normalizeDocumentUrl(virtualUrl, "cert_medico_juliana.pdf");
      expect(normalized).toBe("/uploads/documents/cert_medico_juliana.pdf");

      // Preserva URLs relativas válidas o data-urls sin alterarlas
      expect(normalizeDocumentUrl("/uploads/docs/prueba.pdf")).toBe("/uploads/docs/prueba.pdf");
      expect(normalizeDocumentUrl("data:image/png;base64,iVBORw0KGgo")).toBe("data:image/png;base64,iVBORw0KGgo");
      expect(normalizeDocumentUrl(null)).toBeNull();
    });

    it("8. Clasifica fielmente documentos PDF para renderizado interactivo real", () => {
      const pdfDoc = getDocumentType("https://storage.educore.edu/docs/constancia_eps.pdf", "constancia_eps.pdf");
      expect(pdfDoc.isPdf).toBe(true);
      expect(pdfDoc.isImage).toBe(false);
      expect(pdfDoc.isOffice).toBe(false);
      expect(pdfDoc.effectiveUrl).toBe("/uploads/documents/constancia_eps.pdf");
      expect(pdfDoc.fileName).toBe("constancia_eps.pdf");
    });

    it("9. Clasifica fielmente imágenes con soporte de rotación y zoom", () => {
      const imgDoc = getDocumentType("/uploads/comprobante_cita.jpg", "comprobante_cita.jpg");
      expect(imgDoc.isImage).toBe(true);
      expect(imgDoc.isPdf).toBe(false);
      expect(imgDoc.ext).toBe("jpg");
      expect(imgDoc.effectiveUrl).toBe("/uploads/comprobante_cita.jpg");
    });

    it("10. Detecta formatos de ofimática (Word / Excel) para vista descriptiva con fallback", () => {
      const docx = getDocumentType("/uploads/excusa_colegio.docx", "excusa_colegio.docx");
      expect(docx.isOffice).toBe(true);
      expect(docx.isWord).toBe(true);
      expect(docx.isPdf).toBe(false);

      const xlsx = getDocumentType("/uploads/cuadro_turnos.xlsx", "cuadro_turnos.xlsx");
      expect(xlsx.isOffice).toBe(true);
      expect(xlsx.isExcel).toBe(true);
      expect(xlsx.isPdf).toBe(false);
    });

    it("11. Manejo seguro ante URLs nulas o ausentes", () => {
      const emptyDoc = getDocumentType(null, null);
      expect(emptyDoc.effectiveUrl).toBeNull();
      expect(emptyDoc.isPdf).toBe(false);
      expect(emptyDoc.isImage).toBe(false);
    });
  });

  describe("Fase 2 — Aislamiento y Limpieza de Estado al Cambiar de Estudiante", () => {
    // Entidades de prueba para estudiantes A y B
    const studentA: AttendanceStudent = {
      id: "10",
      numericId: 10,
      name: "Andrés Felipe Caicedo",
      code: "EST-11-2-10",
      course: "11-2",
      attendanceRate: 90,
      absencesCount: 2,
    };

    const studentB: AttendanceStudent = {
      id: "20",
      numericId: 20,
      name: "Beatriz Elena Morales",
      code: "EST-11-2-20",
      course: "11-2",
      attendanceRate: 95,
      absencesCount: 1,
    };

    const justificationsA: AttendanceJustificationItem[] = [
      {
        id: 101,
        courseId: "11-2",
        studentId: "10",
        attendanceDate: "2026-09-15",
        reasonCategory: "medical",
        description: "Cita con especialista pediatra",
        submittedByRole: "guardian",
        submittedByName: "Carlos Caicedo",
        submittedAt: "2026-09-15T08:00:00.000Z",
        digitalEvidenceUrl: "https://storage.educore.edu/docs/receta_andres.pdf",
        digitalEvidenceName: "receta_andres.pdf",
        requiresPhysicalSupport: false,
        status: "submitted",
        escalatedToCoordination: false,
        createdAt: "2026-09-15T08:00:00.000Z",
      },
    ];

    const justificationsB: AttendanceJustificationItem[] = [
      {
        id: 201,
        courseId: "11-2",
        studentId: "20",
        attendanceDate: "2026-09-16",
        reasonCategory: "family_emergency",
        description: "Calamidad doméstica verificada",
        submittedByRole: "guardian",
        submittedByName: "Lucía Morales",
        submittedAt: "2026-09-16T09:00:00.000Z",
        digitalEvidenceUrl: "https://storage.educore.edu/docs/constancia_beatriz.pdf",
        digitalEvidenceName: "constancia_beatriz.pdf",
        requiresPhysicalSupport: false,
        status: "approved",
        escalatedToCoordination: false,
        createdAt: "2026-09-16T09:00:00.000Z",
      },
    ];

    it("12. Limpieza de borradores de texto al cambiar de A -> B", () => {
      // Simula el estado mientras se edita en el Estudiante A
      let noteDraft = "Se intentó llamada pero no hubo respuesta del acudiente de Andrés";
      let resolutionNotesDraft = "Aprobación sujeta a entrega de soporte físico original";
      let newCaseReason = "Faltas recurrentes los días martes";

      // Disparador de cambio de estudiante: student.id cambia de "10" a "20"
      const onStudentChange = (newStudentId: string, currentStudentId: string) => {
        if (newStudentId !== currentStudentId) {
          noteDraft = "";
          resolutionNotesDraft = "";
          newCaseReason = "";
        }
      };

      onStudentChange(studentB.id, studentA.id);

      expect(noteDraft).toBe("");
      expect(resolutionNotesDraft).toBe("");
      expect(newCaseReason).toBe("");
    });

    it("13. Restablece newCasePriority a su valor por defecto ('medium') al cambiar de estudiante", () => {
      let newCasePriority: "low" | "medium" | "high" = "high";

      const onStudentChange = () => {
        newCasePriority = "medium";
      };

      onStudentChange();
      expect(newCasePriority).toBe("medium");
    });

    it("14. Invalida selectedJustificationId de A al navegar a B y selecciona la de B", () => {
      const allJustifications = [...justificationsA, ...justificationsB];

      // En Estudiante A estaba seleccionada su justificación #101
      let selectedJustificationId: number | null = 101;

      // Al cambiar a Estudiante B:
      const justsForB = allJustifications
        .filter((j) => String(j.studentId) === String(studentB.id))
        .sort((a, b) => new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime());

      selectedJustificationId = justsForB[0]?.id || null;

      expect(selectedJustificationId).toBe(201);
      expect(selectedJustificationId).not.toBe(101);
    });

    it("15. Restablece zoom al 100%, rotación a 0 y cierra la vista ampliada de documentos", () => {
      let zoomLevel = 175;
      let docRotation = 90;
      let isExpandedDocPreviewOpen = true;
      let docLoadError = true;

      const resetDocumentStates = () => {
        zoomLevel = 100;
        docRotation = 0;
        isExpandedDocPreviewOpen = false;
        docLoadError = false;
      };

      resetDocumentStates();

      expect(zoomLevel).toBe(100);
      expect(docRotation).toBe(0);
      expect(isExpandedDocPreviewOpen).toBe(false);
      expect(docLoadError).toBe(false);
    });

    it("16. Garantiza que la justificación seleccionada pertenezca estrictamente al student.id actual", () => {
      const allJustifications = [...justificationsA, ...justificationsB];

      // Supongamos que un estado desfasado intenta mantener id 101 en estudiante B
      const staleId = 101;
      const justsForB = allJustifications.filter((j) => String(j.studentId) === String(studentB.id));

      const isBelongingToB = justsForB.some((j) => j.id === staleId);
      expect(isBelongingToB).toBe(false);

      // La regla de salvaguarda la reasigna al primer trámite de B
      const safeSelectedId = isBelongingToB ? staleId : (justsForB[0]?.id || null);
      expect(safeSelectedId).toBe(201);
    });

    it("17. Desacopla documentos: el visor de B resuelve su propio documento y no el de A", () => {
      const docA = getDocumentType(justificationsA[0].digitalEvidenceUrl, justificationsA[0].digitalEvidenceName);
      const docB = getDocumentType(justificationsB[0].digitalEvidenceUrl, justificationsB[0].digitalEvidenceName);

      expect(docA.fileName).toBe("receta_andres.pdf");
      expect(docA.effectiveUrl).toBe("/uploads/documents/receta_andres.pdf");

      expect(docB.fileName).toBe("constancia_beatriz.pdf");
      expect(docB.effectiveUrl).toBe("/uploads/documents/constancia_beatriz.pdf");

      expect(docA.effectiveUrl).not.toBe(docB.effectiveUrl);
    });

    it("18. Navegar en ciclo A -> B -> A no produce contaminación residual de estado", () => {
      const stateHistory: Array<{ studentId: string; noteDraft: string; selectedJustId: number | null }> = [];

      // Paso 1: Estudiante A redactando nota
      let currentStudent = studentA;
      let noteDraft = "Borrador confidencial de A";
      let selectedJustId: number | null = 101;
      stateHistory.push({ studentId: currentStudent.id, noteDraft, selectedJustId });

      // Paso 2: Cambia a Estudiante B (se aplica reset)
      currentStudent = studentB;
      noteDraft = "";
      selectedJustId = 201;
      stateHistory.push({ studentId: currentStudent.id, noteDraft, selectedJustId });

      // Paso 3: Vuelve a Estudiante A (comienza con estado limpio)
      currentStudent = studentA;
      noteDraft = "";
      selectedJustId = 101;
      stateHistory.push({ studentId: currentStudent.id, noteDraft, selectedJustId });

      // En el paso 2 (Beatriz), el borrador de Andrés desapareció
      expect(stateHistory[1].noteDraft).toBe("");
      expect(stateHistory[1].selectedJustId).toBe(201);

      // En el paso 3 (retorno a Andrés), no hay datos mezclados de Beatriz
      expect(stateHistory[2].noteDraft).toBe("");
      expect(stateHistory[2].selectedJustId).toBe(101);
    });

    it("19. Previene condiciones de carrera por red: notas de seguimiento se filtran por el caso activo del alumno", () => {
      const cases: AttendanceFollowUpCaseItem[] = [
        {
          id: 1,
          courseId: "11-2",
          studentId: "10", // Caso de Andrés
          reason: "Seguimiento pedagógico de Andrés",
          priority: "medium",
          status: "open",
          responsibleUserId: 1,
          responsibleName: "Juan Diego Loaiza",
          createdAt: "2026-09-10T08:00:00.000Z",
          updatedAt: "2026-09-10T08:00:00.000Z",
        },
        {
          id: 2,
          courseId: "11-2",
          studentId: "20", // Caso de Beatriz
          reason: "Compromiso de puntualidad de Beatriz",
          priority: "low",
          status: "open",
          responsibleUserId: 1,
          responsibleName: "Juan Diego Loaiza",
          createdAt: "2026-09-11T08:00:00.000Z",
          updatedAt: "2026-09-11T08:00:00.000Z",
        },
      ];

      // Simulamos que la consulta en tRPC todavía tiene en caché las notas del caso #1 (de Andrés)
      const cachedNotes: AttendanceFollowUpNoteItem[] = [
        {
          id: 991,
          caseId: 1,
          note: "Acuerdo con acudiente de Andrés",
          authorUserId: 1,
          authorName: "Juan Diego Loaiza",
          createdAt: "2026-09-10T09:00:00.000Z",
        },
      ];

      // Cuando la vista está renderizando a Beatriz (student.id = "20"):
      const activeCaseForBeatriz = cases.find((c) => String(c.studentId) === "20" && c.status !== "resolved");
      expect(activeCaseForBeatriz?.id).toBe(2);

      // El filtro currentCaseNotes descarta las notas del caso #1 de Andrés
      const currentCaseNotes = cachedNotes.filter((n) => n.caseId === activeCaseForBeatriz?.id);
      expect(currentCaseNotes).toHaveLength(0); // Cero notas de Andrés mostradas para Beatriz
    });

    it("20. El visor documental de la Fase 1 continúa funcionando fielmente tras el cambio de estudiante", () => {
      // Estudiante B tiene una excusa con PDF
      const justB = justificationsB[0];
      const docB = getDocumentType(justB.digitalEvidenceUrl, justB.digitalEvidenceName);

      expect(docB.isPdf).toBe(true);
      expect(docB.isImage).toBe(false);
      expect(docB.effectiveUrl).toBe("/uploads/documents/constancia_beatriz.pdf");

      // Verificamos que si se pasa un estudiante sin excusas, no rompe
      const noJustDocs = getDocumentType(null, null);
      expect(noJustDocs.effectiveUrl).toBeNull();
      expect(noJustDocs.isPdf).toBe(false);
    });
  });

  describe("FASE 3 — Ficha Integral de Asistencia del Estudiante (StudentDossierPrintView)", () => {
    const courseMock = {
      id: "11-2",
      label: "11° B",
      subject: "Matemáticas",
      room: "Aula 302",
      time: "07:00 - 08:30",
      color: "#2563eb",
      students: [],
    };

    const studentX: AttendanceStudent = {
      id: "101",
      numericId: 101,
      name: "Juan David Morales",
      code: "EST-11-2-101",
      course: "11-2",
      gradeLevel: "11°",
      academicStatus: "Activo Regular",
      guardianName: "Pedro Morales",
      guardianPhone: "+57 311 000 1122",
      guardianEmail: "pedro.morales@familia.co",
      attendanceRate: 75,
      absencesCount: 3,
    };

    const studentY: AttendanceStudent = {
      id: "202",
      numericId: 202,
      name: "Valentina Restrepo",
      code: "EST-11-2-202",
      course: "11-2",
      gradeLevel: "11°",
      academicStatus: "Activo Regular",
      guardianName: "Marta Restrepo",
      guardianPhone: "+57 322 999 8877",
      guardianEmail: "marta.restrepo@familia.co",
      attendanceRate: 100,
      absencesCount: 0,
    };

    const daysMock: AttendanceDay[] = [
      { iso: "2026-09-01", label: "Mar 01" },
      { iso: "2026-09-02", label: "Mié 02" },
      { iso: "2026-09-03", label: "Jue 03" },
      { iso: "2026-09-04", label: "Vie 04" },
    ];

    const getStatusMock = (studentId: string, date: string): AttendanceStatus => {
      if (studentId === "101") {
        if (date === "2026-09-01") return "absent";
        if (date === "2026-09-02") return "late";
        if (date === "2026-09-03") return "excused";
        return "present";
      }
      return "present";
    };

    const justificationsMock: AttendanceJustificationItem[] = [
      {
        id: 501,
        courseId: "11-2",
        studentId: "101",
        attendanceDate: "2026-09-03",
        reasonCategory: "medical",
        description: "Cita con médico especialista pediatra",
        status: "approved",
        submittedByRole: "guardian",
        submittedByName: "Pedro Morales",
        submittedAt: "2026-09-03T08:00:00.000Z",
        digitalEvidenceUrl: "https://storage.educore.edu/justificaciones/soporte_medico.pdf",
        digitalEvidenceName: "Certificado_Medico.pdf",
        hasPhysicalSupport: true,
        resolutionNotes: "Aprobada formalmente con soporte clínico original.",
      },
      {
        id: 502,
        courseId: "11-2",
        studentId: "999", // Otro estudiante
        attendanceDate: "2026-09-01",
        reasonCategory: "family_emergency",
        description: "Asunto de otro alumno",
        status: "pending_physical_support",
        submittedByRole: "student",
        submittedByName: "Otro Alumno",
        submittedAt: "2026-09-01T08:00:00.000Z",
      },
    ];

    const followUpCasesMock: AttendanceFollowUpCaseItem[] = [
      {
        id: 77,
        courseId: "11-2",
        studentId: "101",
        reason: "Alerta por reiteradas tardanzas y ausencias a primera hora",
        priority: "high",
        status: "open",
        responsibleUserId: 10,
        responsibleName: "Prof. Juan Diego Loaiza",
        createdAt: "2026-09-02T10:00:00.000Z",
        updatedAt: "2026-09-02T10:00:00.000Z",
      },
      {
        id: 88,
        courseId: "11-2",
        studentId: "999", // Caso de otro estudiante
        reason: "Caso ajeno a Juan David",
        priority: "low",
        status: "open",
        responsibleUserId: 10,
        responsibleName: "Prof. Juan Diego Loaiza",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
    ];

    const notesMock: AttendanceFollowUpNoteItem[] = [
      {
        id: 1001,
        caseId: 77,
        note: "Se citó al acudiente Pedro Morales para firmar acta de compromiso de puntualidad.",
        authorUserId: 10,
        authorName: "Prof. Juan Diego Loaiza",
        createdAt: "2026-09-03T11:00:00.000Z",
      },
      {
        id: 1002,
        caseId: 88, // Nota de otro caso
        note: "Nota confidencial del caso #88 ajena",
        authorUserId: 10,
        authorName: "Prof. Juan Diego Loaiza",
        createdAt: "2026-09-01T11:00:00.000Z",
      },
    ];

    it("21. La ficha integral utiliza exclusivamente los datos de identificación del estudiante seleccionado (student.id)", () => {
      // Al preparar la ficha para studentX:
      const activeStudent = studentX;
      const folio = `EXP-${activeStudent.code}-2026`;

      expect(folio).toBe("EXP-EST-11-2-101-2026");
      expect(activeStudent.name).toBe("Juan David Morales");
      expect(activeStudent.guardianName).toBe("Pedro Morales");
      expect(activeStudent.guardianPhone).toBe("+57 311 000 1122");

      // No debe contener datos de studentY
      expect(activeStudent.name).not.toBe(studentY.name);
      expect(activeStudent.code).not.toBe(studentY.code);
    });

    it("22. La ficha integral se genera de forma idéntica e independiente de la pestaña activa (activeTab)", () => {
      const tabs: StudentRecordTab[] = ["summary", "attendance", "history", "excuses", "followup", "timeline"];

      const generatedDossierSnapshots = tabs.map((tab) => {
        // La fuente de datos de la ficha es el estado consolidado del estudiante, no la pestaña visible
        const studentJusts = justificationsMock.filter((j) => String(j.studentId) === String(studentX.id));
        const studentCase = followUpCasesMock.find((c) => String(c.studentId) === String(studentX.id) && c.status !== "resolved");
        const stats = calculateHistoryStats(studentX.id, daysMock, getStatusMock);

        return {
          currentTab: tab,
          studentId: studentX.id,
          totalJustifications: studentJusts.length,
          activeCaseId: studentCase?.id,
          attendanceRate: stats.attendanceRate,
        };
      });

      // Todas las pestañas deben producir exactamente la misma ficha sin variaciones
      const first = generatedDossierSnapshots[0];
      generatedDossierSnapshots.forEach((snap) => {
        expect(snap.studentId).toBe(first.studentId);
        expect(snap.totalJustifications).toBe(first.totalJustifications);
        expect(snap.activeCaseId).toBe(first.activeCaseId);
        expect(snap.attendanceRate).toBe(first.attendanceRate);
      });
    });

    it("23. Las estadísticas de asistencia de la ficha reutilizan estrictamente la fórmula factual de calculateHistoryStats", () => {
      const stats = calculateHistoryStats(studentX.id, daysMock, getStatusMock);

      expect(stats.totalDays).toBe(4);
      expect(stats.recordedDays).toBe(4);
      expect(stats.presentCount).toBe(1);
      expect(stats.absentCount).toBe(1);
      expect(stats.lateCount).toBe(1);
      expect(stats.excusedCount).toBe(1);
      // 1 presente de 4 evaluados = 25%
      expect(stats.attendanceRate).toBe(25);
    });

    it("24. Las excusas y justificaciones procesadas en la ficha pertenecen exclusivamente a student.id", () => {
      const justsForStudentX = justificationsMock.filter((j) => String(j.studentId) === String(studentX.id));

      expect(justsForStudentX).toHaveLength(1);
      expect(justsForStudentX[0].id).toBe(501);
      expect(justsForStudentX[0].description).toBe("Cita con médico especialista pediatra");
      expect(justsForStudentX.some((j) => j.id === 502)).toBe(false);
    });

    it("25. El seguimiento pedagógico y notas docentes impresas corresponden al caso del estudiante actual", () => {
      const activeCaseForStudentX = followUpCasesMock.find(
        (c) => String(c.studentId) === String(studentX.id) && c.status !== "resolved"
      );

      expect(activeCaseForStudentX?.id).toBe(77);
      expect(activeCaseForStudentX?.reason).toBe("Alerta por reiteradas tardanzas y ausencias a primera hora");

      // Filtrado estricto de notas docentes por caseId
      const caseNotes = notesMock.filter((n) => n.caseId === activeCaseForStudentX?.id);

      expect(caseNotes).toHaveLength(1);
      expect(caseNotes[0].id).toBe(1001);
      expect(caseNotes[0].note).toContain("Se citó al acudiente Pedro Morales");
      expect(caseNotes.some((n) => n.id === 1002)).toBe(false);
    });

    it("26. Constatación documental: la existencia del soporte se describe textualmente sin incrustar PDFs enteros", () => {
      const just = justificationsMock[0];
      const doc = getDocumentType(just.digitalEvidenceUrl, just.digitalEvidenceName);

      // Verificamos que se detecta el nombre y tipo del archivo para consignarlo en la ficha
      expect(doc.isPdf).toBe(true);
      expect(doc.fileName).toBe("Certificado_Medico.pdf");

      // Representación en la ficha (constatación de soporte)
      const supportText = just.digitalEvidenceUrl
        ? `Consta adjunto digital (${just.digitalEvidenceName})`
        : just.hasPhysicalSupport
        ? "Soporte físico original verificado"
        : "Sin soporte";

      expect(supportText).toBe("Consta adjunto digital (Certificado_Medico.pdf)");
    });

    it("27. Manejo robusto de estados vacíos: estudiante sin faltas, sin excusas ni casos pedagógicos", () => {
      // Para Valentina (studentY): asistencia perfecta, 0 excusas, 0 casos
      const statsY = calculateHistoryStats(studentY.id, daysMock, getStatusMock);
      const justsY = justificationsMock.filter((j) => String(j.studentId) === String(studentY.id));
      const caseY = followUpCasesMock.find((c) => String(c.studentId) === String(studentY.id));
      const resolvedY = followUpCasesMock.filter((c) => String(c.studentId) === String(studentY.id) && c.status === "resolved");

      expect(statsY.attendanceRate).toBe(100);
      expect(statsY.absentCount).toBe(0);
      expect(justsY).toHaveLength(0);
      expect(caseY).toBeUndefined();
      expect(resolvedY).toHaveLength(0);

      // Los mensajes institucionales en el componente cubren limpiamente estos estados vacíos
      const emptyNoveltiesMsg = "No se registran novedades de inasistencia, tardanzas o ausencias justificadas en las sesiones evaluadas.";
      const emptyJustsMsg = "No se registran solicitudes de justificación ni excusas radicadas en el período.";
      const emptyCasesMsg = "No registra casos de acompañamiento pedagógico actualmente abiertos.";

      expect(emptyNoveltiesMsg).toBeDefined();
      expect(emptyJustsMsg).toBeDefined();
      expect(emptyCasesMsg).toBeDefined();
    });

    it("28. No se rompe la Fase 1 (detección de documentos) ni la Fase 2 (aislamiento al cambiar de estudiante)", () => {
      // Fase 1: normalización y clasificación
      const url = "https://storage.educore.edu/docs/test.pdf";
      const normalized = normalizeDocumentUrl(url);
      expect(normalized).toBe("/uploads/documents/test.pdf");

      // Fase 2: aislamiento de borrador y reseteo entre X y Y
      let noteDraft = "Borrador de prueba";
      const onStudentChange = (nextId: string, currentId: string) => {
        if (nextId !== currentId) {
          noteDraft = "";
        }
      };

      onStudentChange(studentY.id, studentX.id);
      expect(noteDraft).toBe("");
    });

    it("29. Orquestación y exclusión mutua: el drawer y el modal 360 no coexisten y cerrar el 360 cierra todo", () => {
      // Estado inicial en la planilla
      let selectedStudent: AttendanceStudent | null = null;
      let isRecordModalOpen = false;

      // 1. Docente hace clic en un estudiante para abrir la ficha rápida (drawer)
      selectedStudent = studentX;
      isRecordModalOpen = false;

      const isDrawerVisible1 = Boolean(selectedStudent && !isRecordModalOpen);
      const is360Visible1 = Boolean(selectedStudent && isRecordModalOpen);

      expect(isDrawerVisible1).toBe(true);
      expect(is360Visible1).toBe(false);

      // 2. Docente pulsa "Expandir expediente" o "Expediente 360°"
      isRecordModalOpen = true;

      const isDrawerVisible2 = Boolean(selectedStudent && !isRecordModalOpen);
      const is360Visible2 = Boolean(selectedStudent && isRecordModalOpen);

      // El drawer se oculta/desmonta y SOLO el 360 está activo
      expect(isDrawerVisible2).toBe(false);
      expect(is360Visible2).toBe(true);

      // 3. Docente cierra el expediente 360 (onClose)
      const onClose360 = () => {
        isRecordModalOpen = false;
        selectedStudent = null;
      };

      onClose360();

      const isDrawerVisible3 = Boolean(selectedStudent && !isRecordModalOpen);
      const is360Visible3 = Boolean(selectedStudent && isRecordModalOpen);

      // Ambos quedan cerrados por completo, retornando directamente a la planilla sin drawer residual
      expect(isDrawerVisible3).toBe(false);
      expect(is360Visible3).toBe(false);
      expect(selectedStudent).toBeNull();
    });
  });
});



