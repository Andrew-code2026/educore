import { Icon } from './SharedUI';

interface ClasscoreHeroProps {
  schoolName?: string;
  academicPeriodName?: string;
  coursesCount: number;
  reviewCount: number;
  upcomingCount: number;
  draftsCount: number;
  lastUpdated?: string;
}

export function ClasscoreHero({
  schoolName = 'Gimnasio Moderno del Valle',
  academicPeriodName = 'Periodo 2 · 2026',
  coursesCount,
  reviewCount,
  upcomingCount,
  draftsCount,
  lastUpdated = 'Actualizado hoy',
}: ClasscoreHeroProps) {
  return (
    <>
      <div className="page-intro classcore-hero">
        <div>
          <span className="eyebrow classroom-eyebrow">
            <i /> EDUCORE / AULA VIRTUAL
          </span>
          <div className="identity-lockup">
            <span className="identity-orbit">
              <i />
              <i />
              <b />
            </span>
            <h1>Classroom</h1>
          </div>
          <p className="hero-subtitle">
            <Icon name="spark" size={14} /> Conecta tus asignaturas · {academicPeriodName}
          </p>
        </div>
        <div className="hero-context">
          <div className="context-card">
            <span className="context-card-icon">
              <Icon name="book" size={17} />
            </span>
            <span>
              <small>CICLO LECTIVO</small>
              <strong>{academicPeriodName}</strong>
              <em>
                <Icon name="clock" size={11} /> {lastUpdated}
              </em>
            </span>
          </div>
        </div>
      </div>

      <div className="global-summary classcore-kpis">
        <div className="summary-card">
          <span className="summary-icon cyan">
            <Icon name="book" size={17} />
          </span>
          <div>
            <span className="summary-label">Cursos activos</span>
            <strong>{coursesCount}</strong>
            <small>Espacios docentes</small>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon mint">
            <Icon name="clipboard" size={17} />
          </span>
          <div>
            <span className="summary-label">Entregas</span>
            <strong>{reviewCount}</strong>
            <small>Por revisar</small>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon amber">
            <Icon name="chart" size={17} />
          </span>
          <div>
            <span className="summary-label">Pendientes</span>
            <strong>{upcomingCount}</strong>
            <small>Próximas actividades</small>
          </div>
        </div>

        <div className="summary-card">
          <span className="summary-icon violet">
            <Icon name="layers" size={17} />
          </span>
          <div>
            <span className="summary-label">Evaluaciones</span>
            <strong>{draftsCount}</strong>
            <small>En seguimiento</small>
          </div>
        </div>
      </div>
    </>
  );
}
