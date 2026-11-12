import { LEVELS } from "@/gradecenter/domain/scale";
import { formatGrade, plural } from "../format";
import type { GradesModel } from "../grades/grades";

interface SubjectsCardProps {
  model: GradesModel | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenSubject: (subjectId: number) => void;
  onViewAll: () => void;
}

// Como en "Mis cursos" del docente: el texto cambia de color según quede sobre el relleno o la pista.
// La nota va al extremo derecho, así que solo queda sobre el relleno con 4.8 o más (barra ≥ 96 %).
const NAME_ON_FILL_MIN = 35;
const VALUE_ON_FILL_MIN = 96;

/** "Mis materias": definitiva de cada materia como barra sobre la escala 0–5. */
export function SubjectsCard({ model, loading, error, onRetry, onOpenSubject, onViewAll }: SubjectsCardProps) {
  const subjects = model?.subjects ?? [];
  return (
    <section aria-labelledby="h-materias" className="edc-card edc-courses">
      <div className="edc-card__head">
        <span className="edc-card__bubble">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </span>
        <div className="edc-card__heading">
          <h2 id="h-materias" className="edc-card__title">Mis materias</h2>
          <div className="edc-card__sub">
            {model ? `${plural(subjects.length, "materia", "materias")}${model.periodName ? ` · ${model.periodName}` : ""}` : "Definitivas del periodo"}
          </div>
        </div>
        <button type="button" className="edc-chip-btn" onClick={onViewAll}>
          Ver notas
        </button>
      </div>

      <div className="edc-courses__body">
        <div className="edc-courses__caption">
          <span className="edc-courses__eyebrow">Definitiva parcial</span>
          {model?.average != null && <span className="edc-courses__deadline">Promedio {formatGrade(model.average)}</span>}
        </div>

        {loading && !model && <div className="edc-empty-note" aria-busy="true">Cargando tus notas…</div>}
        {error && !model && (
          <div className="edc-empty-note" role="alert">
            No pudimos cargar tus notas.{" "}
            <button type="button" className="edc-chip-btn" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}

        {subjects.map(subject => {
          const progress = subject.average != null ? Math.round((subject.average / 5) * 100) : 0;
          const level = subject.level ? LEVELS[subject.level].short : "Sin notas aún";
          return (
            <button key={subject.id} type="button" className="edc-course" onClick={() => onOpenSubject(subject.id)}>
              <div
                role="progressbar"
                aria-valuenow={subject.average ?? 0}
                aria-valuemin={0}
                aria-valuemax={5}
                aria-label={`Definitiva de ${subject.name}`}
                className="edc-progress"
              >
                <div className="edc-progress__fill" style={{ width: `${progress}%` }} />
                <div className="edc-progress__labels">
                  <span className={`edc-progress__name ${progress >= NAME_ON_FILL_MIN ? "edc-on-fill" : "edc-on-track"}`}>{subject.name}</span>
                  <span className={`edc-progress__value ${progress >= VALUE_ON_FILL_MIN ? "edc-on-fill" : "edc-on-track"}`}>
                    {subject.average != null ? formatGrade(subject.average) : "—"}
                  </span>
                </div>
              </div>
              <div className="edc-course__meta">
                {subject.teacherName ? `${subject.teacherName} · ` : ""}
                {subject.needsAttention ? (
                  <span className="edc-course__avg--low">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    {level}
                  </span>
                ) : (
                  <span className="edc-course__avg">{level}</span>
                )}
              </div>
            </button>
          );
        })}

        {model && subjects.length === 0 && <div className="edc-empty-note">Aún no hay materias con evaluaciones en este periodo.</div>}
      </div>
    </section>
  );
}
