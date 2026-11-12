import type { Section } from "@/components/shell/shell.types";
import { CalendarPage } from "@/pages/Calendar";
import { CommunicationsPage } from "@/pages/Communications";
import { StudentAttendancePage } from "./attendance/AttendancePage";
import { StudentGradesPage } from "./grades/GradesPage";
import { StudentHome } from "./home/StudentHome";
import { StudentTasksPage } from "./tasks/TasksPage";

interface StudentPortalProps {
  section: Section;
  data: any;
  user: any;
  setSection: (section: Section) => void;
  onChanged: () => void;
}

/**
 * Portal del estudiante: seis secciones. Inicio, Tareas, Calificaciones y Asistencia son propias;
 * Calendario y Comunicaciones son los módulos del colegio, que ya son de solo lectura para el estudiante.
 */
export function StudentPortal({ section, data, user, setSection, onChanged }: StudentPortalProps) {
  switch (section) {
    case "classroom":
      return <StudentTasksPage data={data} onChanged={onChanged} />;
    case "grades":
      return <StudentGradesPage data={data} />;
    case "attendance":
      return <StudentAttendancePage data={data} user={user} />;
    case "calendar":
      return <CalendarPage data={data} role="student" onChanged={onChanged} />;
    case "communications":
      return <CommunicationsPage data={data} role="student" onChanged={onChanged} />;
    default:
      return <StudentHome data={data} user={user} setSection={setSection} />;
  }
}
