import type { Activity, Upload } from '../types';
import { Icon, ProgressBar, StatusPill } from './SharedUI';

interface StudentPreviewModalProps {
  activity: Activity;
  uploaded: Upload[];
  error: string;
  sent: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  onSend: () => void;
  onRemove: (index: number) => void;
}

export function StudentPreviewModal({
  activity,
  uploaded,
  error,
  sent,
  onClose,
  onFile,
  onSend,
  onRemove,
}: StudentPreviewModalProps) {
  return (
    <div
      className="drawer-layer"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="student-preview-drawer">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">PREVISUALIZACIÓN · ESTUDIANTE</span>
            <h2>{activity.name}</h2>
            <p>Así verá el estudiante la actividad y gestionará su entrega.</p>
          </div>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="drawer-body preview-body">
          <div className="student-instructions">
            <span className="activity-icon cyan">↗</span>
            <div>
              <strong>Instrucciones de la actividad</strong>
              <p>{activity.description}</p>
              <small>Fecha límite fijada · {activity.dueDate}</small>
            </div>
          </div>

          <div className="upload-section">
            <div className="form-section-title">ENTREGA DE EVIDENCIA</div>

            {sent ? (
              <div className="sent-state">
                <span>
                  <Icon name="check" size={24} />
                </span>
                <strong>Entrega enviada</strong>
                <p>Archivo recibido y registrado · {uploaded[0]?.name || 'entrega-final.pdf'}</p>
                <StatusPill status="Entregada" />
              </div>
            ) : (
              <>
                <label className="drop-zone">
                  <input
                    type="file"
                    accept={activity.formats.map((f) => `.${f.toLowerCase()}`).join(',')}
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                  />
                  <span>
                    <Icon name="download" size={25} />
                  </span>
                  <strong>Arrastra tu evidencia aquí</strong>
                  <small>
                    o haz clic para explorar · {activity.formats.join(', ')} · máximo{' '}
                    {activity.maxSize}
                  </small>
                  <b>Seleccionar archivo</b>
                </label>

                {error && <div className="upload-error">{error}</div>}

                {uploaded.map((file, index) => (
                  <div className="uploaded-file" key={`${file.name}-${index}`}>
                    <span className="file-icon">
                      <Icon name="clipboard" size={15} />
                    </span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>
                        {file.format} · {file.size}
                      </small>
                      <ProgressBar value={file.progress} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      title="Quitar archivo"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}

                <div className="upload-actions">
                  <span>
                    {uploaded.length} / {activity.maxFiles} archivos cargados
                  </span>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={onSend}
                    disabled={!uploaded.length}
                  >
                    Enviar entrega <Icon name="arrow" size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          <span>Vista interactiva · verifica la experiencia del estudiante</span>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </aside>
    </div>
  );
}
