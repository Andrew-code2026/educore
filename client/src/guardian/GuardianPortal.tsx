import { Users } from "lucide-react";
import type { Section } from "@/components/shell/shell.types";
import { CalendarPage } from "@/pages/Calendar";
import { CommunicationsPage } from "@/pages/Communications";
import { StudentAttendancePage } from "@/student/attendance/AttendancePage";
import { StudentGradesPage } from "@/student/grades/GradesPage";
import { EmptyState, ErrorState, PageFrame, PageSkeleton } from "@/student/ui";
import type { Viewer } from "@/student/viewer";
import { ChildSwitcher } from "./ChildSwitcher";
import { useGuardianChildren } from "./children";
import { GuardianHome } from "./home/GuardianHome";

interface GuardianPortalProps {
  section: Section;
  data: any;
  user: any;
  setSection: (section: Section) => void;
  onChanged: () => void;
}

/**
 * Portal del acudiente: cinco secciones. Inicio es propio; Calificaciones y Asistencia son las
 * páginas del estudiante vistas por el acudiente (con selector de hijo); Calendario y
 * Comunicaciones son los módulos del colegio, de solo lectura para la familia.
 */
export function GuardianPortal({ section, data, user, setSection, onChanged }: GuardianPortalProps) {
  const family = useGuardianChildren();

  if (!family.child) {
    return (
      <PageFrame label="Portal del acudiente">
        {family.isLoading ? (
          <PageSkeleton label="Cargando a sus estudiantes" />
        ) : family.isError ? (
          <ErrorState onRetry={family.refetch} title="No pudimos cargar a sus estudiantes" />
        ) : (
          <EmptyState
            page
            icon={<Users aria-hidden="true" strokeWidth={1.9} />}
            title="Aún no tiene estudiantes vinculados"
            note="Pida a la secretaría del colegio que vincule su cuenta con la de su hijo o hija."
          />
        )}
      </PageFrame>
    );
  }

  const viewer: Extract<Viewer, { kind: "guardian" }> = {
    kind: "guardian",
    child: { id: family.child.id, name: family.child.name, courseName: family.child.courseName },
    // Firma de las excusas: el servidor exige un nombre
    guardianName: user?.name?.trim() || "Acudiente",
  };
  const switcher = <ChildSwitcher items={family.children} selectedId={family.child.id} onSelect={family.setChild} />;

  switch (section) {
    case "grades":
      // `key`: al cambiar de hijo, periodo y materia abierta vuelven a empezar
      return <StudentGradesPage key={viewer.child.id} data={data} viewer={viewer} switcher={switcher} />;
    case "attendance":
      return <StudentAttendancePage key={viewer.child.id} data={data} user={user} viewer={viewer} switcher={switcher} />;
    case "calendar":
      return <CalendarPage data={data} role="guardian" onChanged={onChanged} />;
    case "communications":
      return <CommunicationsPage data={data} role="guardian" onChanged={onChanged} />;
    default:
      return <GuardianHome data={data} viewer={viewer} switcher={switcher} setSection={setSection} />;
  }
}
