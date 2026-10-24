import { memo } from "react";
import { ArrowRight, FileText } from "lucide-react";
import type { JustificationModel } from "./landing";

interface PendingJustificationsProps {
  items: JustificationModel[];
  onReview: (item: JustificationModel) => void;
}

export const PendingJustifications = memo(function PendingJustifications({ items, onReview }: PendingJustificationsProps) {
  return (
    <div className="atl-group-block">
      <h3 id="atl-just-heading" className="atl-subhead">
        Justificaciones por revisar
        <span className="atl-count atl-num">{items.length}</span>
      </h3>
      <ul aria-labelledby="atl-just-heading" className="atl-surface atl-list">
        {items.map((item) => (
          <li key={item.id} className="atl-just">
            <span aria-hidden="true" className="atl-just__avatar">
              {item.initials}
            </span>
            <div className="atl-just__body">
              <span className="atl-just__name">{item.studentName}</span>
              <span className="atl-just__detail">
                Ausencia del {item.absenceDate} · {item.courseLabel} · {item.reason}
              </span>
            </div>
            {item.attachment && (
              <span className="atl-just__file">
                <FileText aria-hidden="true" strokeWidth={1.9} />
                {item.attachment}
              </span>
            )}
            <button
              type="button"
              className="atl-btn atl-btn--primary atl-btn--review"
              aria-label={`Revisar justificación de ${item.studentName}, ausencia del ${item.absenceDate}`}
              onClick={() => onReview(item)}
            >
              Revisar
              <ArrowRight aria-hidden="true" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
