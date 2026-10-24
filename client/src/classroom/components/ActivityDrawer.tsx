import { useEffect, useState } from 'react';
import type { Draft } from '../types';
import { Icon } from './SharedUI';

const FILE_OPTIONS = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'JPG', 'PNG', 'MP4', 'ZIP'];

interface ActivityDrawerProps {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onClose: () => void;
  onSave: () => void;
  onPublish: () => void;
  isPending?: boolean;
}

export function ActivityDrawer({
  draft,
  setDraft,
  onClose,
  onSave,
  onPublish,
  isPending = false,
}: ActivityDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const closeModal = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(onClose, 190);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isClosing]);

  return (
    <div
      className="drawer-layer activity-creator-layer"
      onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
    >
      <aside
        className={`activity-drawer wide-drawer activity-creator-modal ${
          isClosing ? 'is-closing' : ''
        }`}
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">IDEAR · CONFIGURAR · PUBLICAR</span>
            <h2>Nueva actividad</h2>
            <p>Crear un trabajo digital para tus estudiantes en EduCore.</p>
          </div>
          <button type="button" className="icon-button subtle" onClick={closeModal}>
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="drawer-body editor-body">
          <div className="editor-columns">
            {/* Columna Izquierda: Información & Entrega */}
            <div>
              <span className="form-section-title">INFORMACIÓN</span>
              <label>
                Título
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Ej. Taller experimental de derivadas"
                />
              </label>

              <label>
                Descripción e instrucciones
                <div className="rich-editor">
                  <div className="editor-tools">
                    <b>B</b>
                    <i>I</i>
                    <span>• Lista</span>
                    <span>↗ Enlace</span>
                    <span>▣ Imagen</span>
                    <span>⊞ Tabla</span>
                  </div>
                  <textarea
                    value={draft.description}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Qué deben crear, analizar, investigar o demostrar…"
                  />
                </div>
              </label>

              <div className="creator-resource-block">
                <div className="creator-block-heading">
                  <span>
                    <Icon name="paperclip" size={15} /> Adjuntar recursos
                  </span>
                  <small>Material de apoyo o guía para la entrega</small>
                </div>
                <div className="resource-attach-actions">
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        description:
                          draft.description + '\n[Recurso adjunto: Guía metodológica institucional]',
                      })
                    }
                  >
                    <Icon name="upload" size={14} /> Subir archivo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        description:
                          draft.description + '\n[Enlace externo: Biblioteca virtual EduCore]',
                      })
                    }
                  >
                    <Icon name="link" size={14} /> Añadir enlace
                  </button>
                </div>
              </div>

              <div className="activity-content-preview">
                <span className="form-section-title">VISTA PREVIA DEL CONTENIDO</span>
                <strong>{draft.name || 'Título de la actividad'}</strong>
                <p>
                  {draft.description ||
                    'Aquí aparecerán las instrucciones que verá el estudiante al ingresar.'}
                </p>
                <small>El estudiante verá esta actividad en su portal con fecha y recursos.</small>
              </div>

              <span className="form-section-title">ENTREGA DIGITAL</span>
              <div className="choice-card selected">
                <span className="choice-radio" />
                <div>
                  <strong>Entrega de archivo</strong>
                  <small>El estudiante adjunta evidencias en formatos autorizados.</small>
                </div>
                <Icon name="clipboard" size={16} />
              </div>

              <div className="form-grid">
                <label>
                  Cantidad máxima
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={draft.maxFiles}
                    onChange={(e) => update({ maxFiles: Number(e.target.value) || 1 })}
                  />
                </label>
                <label>
                  Tamaño por archivo
                  <select
                    value={draft.maxSize}
                    onChange={(e) => update({ maxSize: e.target.value })}
                  >
                    <option>10 MB</option>
                    <option>25 MB</option>
                    <option>50 MB</option>
                    <option>100 MB</option>
                  </select>
                </label>
              </div>

              <label>
                Formatos permitidos
                <div className="format-picker">
                  {FILE_OPTIONS.map((format) => (
                    <button
                      type="button"
                      key={format}
                      className={draft.formats.includes(format) ? 'selected' : ''}
                      onClick={() =>
                        update({
                          formats: draft.formats.includes(format)
                            ? draft.formats.filter((f) => f !== format)
                            : [...draft.formats, format],
                        })
                      }
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </label>

              <span className="creator-subsection-label">Intentos y reenvíos</span>
              <div className="toggle-row">
                <span>Permitir reemplazo antes de la fecha límite</span>
                <button
                  type="button"
                  className={`toggle ${draft.allowReplacement ? 'on' : ''}`}
                  onClick={() => update({ allowReplacement: !draft.allowReplacement })}
                >
                  <i />
                </button>
              </div>
              <div className="toggle-row">
                <span>Permitir reenvío después de corrección</span>
                <button
                  type="button"
                  className={`toggle ${draft.allowResubmission ? 'on' : ''}`}
                  onClick={() => update({ allowResubmission: !draft.allowResubmission })}
                >
                  <i />
                </button>
              </div>
            </div>

            {/* Columna Derecha: Configuración & Evaluación */}
            <div>
              <span className="form-section-title">CONFIGURACIÓN</span>
              <span className="creator-subsection-label">Fechas y publicación</span>
              <div className="form-grid">
                <label>
                  Publicación
                  <input
                    type="date"
                    value={draft.publish}
                    onChange={(e) => update({ publish: e.target.value })}
                  />
                </label>
                <label>
                  Fecha límite
                  <input
                    type="date"
                    value={draft.due}
                    onChange={(e) => update({ due: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Hora de cierre
                <input type="time" defaultValue="23:59" />
              </label>

              <span className="form-section-title">EVALUACIÓN</span>
              <div className="segmented wide">
                <button
                  type="button"
                  className={draft.graded ? 'active' : ''}
                  onClick={() => update({ graded: true })}
                >
                  Sí, calificada
                </button>
                <button
                  type="button"
                  className={!draft.graded ? 'active' : ''}
                  onClick={() => update({ graded: false })}
                >
                  No calificada
                </button>
              </div>

              {draft.graded && (
                <>
                  <label>
                    Escala de calificación
                    <select defaultValue="0.0 – 5.0">
                      <option>0.0 – 5.0 (Institucional Colombia)</option>
                      <option>0 – 100 puntos</option>
                      <option>Logro cualitativo</option>
                    </select>
                  </label>
                  <div className="choice-card">
                    <span className="rubric-dot" />
                    <div>
                      <strong>Rúbrica asociada</strong>
                      <small>Criterios configurables · editables después en calificador</small>
                    </div>
                    <span className="violet-text">✓</span>
                  </div>
                </>
              )}

              <span className="form-section-title">GRADE CENTER</span>
              <div className="grade-choice">
                <div>
                  <strong>¿Registrar en Grade Center?</strong>
                  <small>
                    {draft.gradeCenter
                      ? 'Esta actividad impactará la libreta de calificaciones.'
                      : 'Funciona completamente dentro de ClassCORE.'}
                  </small>
                </div>
                <div className="segmented">
                  <button
                    type="button"
                    className={draft.gradeCenter ? 'active' : ''}
                    onClick={() => update({ gradeCenter: true })}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className={!draft.gradeCenter ? 'active' : ''}
                    onClick={() => update({ gradeCenter: false })}
                  >
                    No
                  </button>
                </div>
              </div>

              {draft.gradeCenter && (
                <label>
                  Peso porcentual sugerido
                  <input
                    value={draft.weight}
                    onChange={(e) => update({ weight: e.target.value })}
                    placeholder="Ej. 20%"
                  />
                </label>
              )}

              <div className="preview-mini">
                <span className="eyebrow">RESUMEN DE CONFIGURACIÓN</span>
                <strong>{draft.name || 'Nueva actividad'}</strong>
                <small>
                  Entrega de archivo · {draft.formats.join(', ') || 'sin formatos especificados'}
                </small>
                <span>
                  {draft.gradeCenter
                    ? `Impacta Grade Center · ${draft.weight || 'sin peso asignado'}`
                    : 'Solo ClassCORE · sin impacto en Grade Center'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-footer creator-footer">
          <span>
            <i className="draft-status-dot" /> Estado inicial: Borrador
          </span>
          <div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="outline-button"
              onClick={onSave}
              disabled={isPending}
            >
              Guardar borrador
            </button>
            <button
              type="button"
              className="outline-button"
              onClick={() =>
                document
                  .querySelector('.activity-content-preview')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              <Icon name="eye" size={14} /> Vista previa
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onPublish}
              disabled={!draft.name.trim() || isPending}
            >
              {isPending ? 'Guardando...' : 'Publicar actividad'}{' '}
              <Icon name="arrow" size={13} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
