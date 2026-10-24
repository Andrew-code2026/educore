import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { capitalize, formatAgo, type PendingReview } from './courses';

interface PendingReviewsProps {
  items: PendingReview[];
  now: Date;
  onReview: (item: PendingReview) => void;
}

export const PendingReviews = memo(function PendingReviews({ items, now, onReview }: PendingReviewsProps) {
  return (
    <section aria-labelledby="ccl-review-heading" className="ccl-section">
      <div className="ccl-section__head">
        <h2 id="ccl-review-heading" className="ccl-section__title">
          Entregas por revisar
        </h2>
        <span className="ccl-count ccl-num">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <ul className="ccl-surface ccl-reviews">
          {items.map((item) => (
            <li key={item.id} className="ccl-review">
              <span aria-hidden="true" className="ccl-review__avatar">
                {item.initials}
              </span>
              <div className="ccl-review__body">
                <span className="ccl-review__name">{item.studentName}</span>
                <span className="ccl-review__detail">
                  {item.activity} · {item.courseLabel}
                </span>
              </div>
              {item.submittedAt && (
                <span className="ccl-review__when">{capitalize(formatAgo(item.submittedAt, now))}</span>
              )}
              <button
                type="button"
                className="ccl-btn ccl-btn--primary ccl-btn--review"
                aria-label={`Revisar entrega de ${item.studentName}: ${item.activity}`}
                onClick={() => onReview(item)}
              >
                Revisar
                <ArrowRight aria-hidden="true" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ccl-surface ccl-reviews-empty">Estás al día. Las nuevas entregas aparecerán aquí.</div>
      )}
    </section>
  );
});
