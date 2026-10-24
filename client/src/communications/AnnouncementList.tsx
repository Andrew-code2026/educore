import { memo, useState } from "react";
import { Copy, FilePen, Megaphone, MoreHorizontal, Send, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AnnouncementModel } from "./landing";

/** Por encima de este largo el mensaje se recorta y aparece "Leer más". */
const CLAMP_CHARS = 180;

export interface AnnouncementActions {
  canSend: boolean;
  /** Id del comunicado con una acción en curso. */
  busyId: number | null;
  onPublish: (item: AnnouncementModel) => void;
  onCopy: (item: AnnouncementModel) => void;
  onDelete: (item: AnnouncementModel) => void;
}

interface AnnouncementListProps extends AnnouncementActions {
  announcements: AnnouncementModel[];
}

export const AnnouncementList = memo(function AnnouncementList({ announcements, ...actions }: AnnouncementListProps) {
  return (
    <ul aria-label="Comunicados" className="cmn-surface cmn-list">
      {announcements.map((item) => (
        <AnnouncementRow key={item.id} item={item} {...actions} />
      ))}
    </ul>
  );
});

function AnnouncementRow({ item, canSend, busyId, onPublish, onCopy, onDelete }: AnnouncementActions & { item: AnnouncementModel }) {
  const [expanded, setExpanded] = useState(false);
  const isDraft = item.status === "draft";
  const isLong = item.message.length > CLAMP_CHARS || item.message.includes("\n");
  const messageId = `cmn-message-${item.id}`;
  const StatusIcon = isDraft ? FilePen : Megaphone;

  return (
    <li className={cn("cmn-item", busyId === item.id && "is-busy")} aria-busy={busyId === item.id}>
      <span aria-hidden="true" className={`cmn-item__icon cmn-item__icon--${item.status}`}>
        <StatusIcon strokeWidth={1.9} />
      </span>

      <article className="cmn-item__body" aria-labelledby={`cmn-title-${item.id}`}>
        <div className="cmn-item__title">
          <h3 id={`cmn-title-${item.id}`} className="cmn-item__name">
            {item.title}
          </h3>
          {isDraft ? (
            <span className="cmn-pill cmn-pill--draft">Borrador</span>
          ) : (
            item.isRecent && <span className="cmn-pill cmn-pill--new">Nuevo</span>
          )}
        </div>

        <div className="cmn-item__meta">
          <span className="cmn-meta">
            <Users aria-hidden="true" strokeWidth={1.9} />
            <span className="cmn-sr">Para:</span>
            {item.audience}
          </span>
          <span aria-hidden="true" className="cmn-sep">
            ·
          </span>
          <time dateTime={item.dateIso || undefined} title={item.dateTitle || undefined}>
            {isDraft ? `Editado ${item.dateLabel.toLowerCase()}` : item.dateLabel}
          </time>
        </div>

        <p id={messageId} className={cn("cmn-item__message", isLong && !expanded && "is-clamped")}>
          {item.message}
        </p>
        {isLong && (
          <button
            type="button"
            className="cmn-link"
            aria-expanded={expanded}
            aria-controls={messageId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Ver menos" : "Leer más"}
          </button>
        )}
      </article>

      <div className="cmn-item__actions">
        {isDraft && canSend && (
          <button
            type="button"
            className="cmn-btn cmn-btn--outline"
            disabled={busyId === item.id}
            onClick={() => onPublish(item)}
          >
            <Send aria-hidden="true" strokeWidth={1.9} />
            Publicar
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="cmn-icon-btn"
              aria-label={`Más acciones para "${item.title}"`}
              disabled={busyId === item.id}
            >
              <MoreHorizontal aria-hidden="true" strokeWidth={1.9} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
            <DropdownMenuItem onSelect={() => onCopy(item)}>
              <Copy aria-hidden="true" />
              Copiar texto
            </DropdownMenuItem>
            {canSend && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
                  <Trash2 aria-hidden="true" />
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
