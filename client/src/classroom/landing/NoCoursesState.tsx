import { ClipboardList } from 'lucide-react';

export function NoCoursesState({ period }: { period: string | null }) {
  return (
    <div className="ccl-surface ccl-no-courses">
      <span aria-hidden="true" className="ccl-no-courses__icon">
        <ClipboardList strokeWidth={1.9} />
      </span>
      <h2 className="ccl-no-courses__title">Aún no tienes cursos asignados</h2>
      <p className="ccl-no-courses__note">
        Cuando coordinación académica te asigne cursos{period ? ` para el ${period}` : ''}, aparecerán
        aquí.
      </p>
    </div>
  );
}
