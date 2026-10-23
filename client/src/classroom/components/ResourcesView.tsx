import { useState } from 'react';
import type { Resource } from '../types';
import { Icon, SectionLabel } from './SharedUI';

interface ResourcesViewProps {
  resources: Resource[];
  onAddResource?: () => void;
}

export function ResourcesView({ resources, onAddResource }: ResourcesViewProps) {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  return (
    <>
      <section className="view-section resources-view">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BIBLIOTECA DEL CURSO</span>
            <h2>Recursos del curso</h2>
            <p>Solo materiales relacionados con actividades que requieren entrega digital.</p>
          </div>
          {onAddResource && (
            <button type="button" className="primary-button" onClick={onAddResource}>
              <Icon name="plus" size={14} /> Añadir recurso
            </button>
          )}
        </div>

        <div className="resource-grid">
          {resources.map((resource) => (
            <button
              type="button"
              className="resource-card glass-card"
              key={resource.title}
              onClick={() => setSelectedResource(resource)}
            >
              <div className={`resource-preview ${resource.color}`}>
                <span>{resource.icon}</span>
                <small>{resource.type}</small>
              </div>
              <div className="resource-card-body">
                <h3>{resource.title}</h3>
                <p>
                  {resource.meta} · usado en {resource.used}
                </p>
                <div>
                  <span className="resource-link">
                    Ver detalles del recurso <Icon name="arrow" size={12} />
                  </span>
                  <Icon name="chevron" size={14} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {!resources.length && (
          <div className="empty-state">
            <Icon name="book" size={24} />
            <strong>No hay recursos cargados</strong>
            <p>Los archivos y guías asociados a las tareas aparecerán aquí.</p>
          </div>
        )}
      </section>

      {selectedResource && (
        <div
          className="drawer-layer"
          onMouseDown={(e) => e.target === e.currentTarget && setSelectedResource(null)}
        >
          <aside className="resource-drawer">
            <div className="drawer-header">
              <div>
                <span className="eyebrow">RECURSO ACADÉMICO</span>
                <h2>{selectedResource.title}</h2>
                <p>
                  {selectedResource.type} · {selectedResource.meta}
                </p>
              </div>
              <button
                type="button"
                className="icon-button subtle"
                onClick={() => setSelectedResource(null)}
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <div className="drawer-body">
              <div className={`resource-large ${selectedResource.color}`}>
                {selectedResource.icon}
              </div>

              <SectionLabel>Usos en actividades de EduCore</SectionLabel>
              <div className="related-list">
                <span>
                  <b>Actividad vinculada:</b> {selectedResource.used}
                </span>
                <span>
                  <b>Formato de archivo:</b> {selectedResource.type}
                </span>
                <span>
                  <b>Disponibilidad:</b> Visible para todos los estudiantes matriculados
                </span>
              </div>
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setSelectedResource(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  window.alert(`Abriendo documento: ${selectedResource.title}`);
                  setSelectedResource(null);
                }}
              >
                Descargar recurso <Icon name="arrow" size={14} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
