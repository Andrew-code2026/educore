/** Seguimiento pedagógico: caso activo con su bitácora, o apertura de uno nuevo. */
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AttendanceFollowUpCaseItem, AttendanceFollowUpNoteItem } from "../types";
import { formatDate, formatDateTime } from "./recordUi";
import { PRIORITY_LABEL } from "./timeline";

type Priority = AttendanceFollowUpCaseItem["priority"];

const CASE_STATUS_LABEL: Record<AttendanceFollowUpCaseItem["status"], string> = {
  open: "Abierto",
  in_review: "En revisión",
  resolved: "Resuelto",
};

interface FollowUpTabProps {
  activeCase?: AttendanceFollowUpCaseItem;
  resolvedCases: AttendanceFollowUpCaseItem[];
  notes: AttendanceFollowUpNoteItem[];
  suggestedReason?: string;
  onOpenCase?: (reason: string, priority: Priority) => void;
  onUpdateCaseStatus?: (caseId: number, status: AttendanceFollowUpCaseItem["status"]) => void;
  onAddNote?: (caseId: number, note: string) => void;
  isOpeningCase: boolean;
  isAddingNote: boolean;
}

export function FollowUpTab({
  activeCase,
  resolvedCases,
  notes,
  suggestedReason,
  onOpenCase,
  onUpdateCaseStatus,
  onAddNote,
  isOpeningCase,
  isAddingNote,
}: FollowUpTabProps) {
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [noteDraft, setNoteDraft] = useState("");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {activeCase ? (
        <section className="rounded-2xl border border-hairline bg-surface-1 p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">
                Caso {CASE_STATUS_LABEL[activeCase.status].toLowerCase()} · prioridad {PRIORITY_LABEL[activeCase.priority].toLowerCase()} ·
                desde {formatDate(activeCase.createdAt)}
              </p>
              <h3 className="mt-1 text-base font-semibold">{activeCase.reason}</h3>
            </div>
            {onUpdateCaseStatus ? (
              <div className="flex items-center gap-2">
                {activeCase.status === "open" ? (
                  <button type="button" onClick={() => onUpdateCaseStatus(activeCase.id, "in_review")} className="record-button">
                    Pasar a revisión
                  </button>
                ) : null}
                <button type="button" onClick={() => onUpdateCaseStatus(activeCase.id, "resolved")} className="record-button is-primary">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Marcar resuelto
                </button>
              </div>
            ) : null}
          </header>

          <h4 className="mt-5 text-sm font-semibold">Notas y acuerdos</h4>
          {notes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Todavía no hay notas en este caso.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {notes.map(note => (
                <li key={note.id} className="rounded-xl bg-foreground/[0.035] px-4 py-3">
                  <p className="text-sm leading-relaxed">{note.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{note.authorName} · {formatDateTime(note.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}

          {onAddNote ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={event => {
                event.preventDefault();
                if (!noteDraft.trim()) return;
                onAddNote(activeCase.id, noteDraft.trim());
                setNoteDraft("");
              }}
            >
              <label htmlFor="case-note" className="sr-only">Nueva nota</label>
              <input
                id="case-note"
                value={noteDraft}
                onChange={event => setNoteDraft(event.target.value)}
                placeholder="Acuerdo, citación o compromiso…"
                className="record-input flex-1"
              />
              <button type="submit" disabled={!noteDraft.trim() || isAddingNote} className="record-button is-primary">
                {isAddingNote ? "Guardando…" : "Agregar"}
              </button>
            </form>
          ) : null}
        </section>
      ) : onOpenCase ? (
        <form
          className="rounded-2xl border border-hairline bg-surface-1 p-5"
          onSubmit={event => {
            event.preventDefault();
            if (!reason.trim()) return;
            onOpenCase(reason.trim(), priority);
            setReason("");
            setPriority("medium");
          }}
        >
          <h3 className="text-base font-semibold">Abrir caso de seguimiento</h3>
          <p className="mt-1 text-sm text-muted-foreground">Registra el motivo para acordar compromisos con el estudiante y su familia.</p>
          <label htmlFor="case-reason" className="mt-4 block text-sm font-medium">Motivo</label>
          <input
            id="case-reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder={suggestedReason ? `Ej. ${suggestedReason}` : "Ej. Compromiso de asistencia y puntualidad"}
            className="record-input mt-1.5"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="record-segmented" role="radiogroup" aria-label="Prioridad">
              {(["low", "medium", "high"] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={priority === option}
                  onClick={() => setPriority(option)}
                  className={cn("record-segmented-option", priority === option && "is-active")}
                >
                  {PRIORITY_LABEL[option]}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!reason.trim() || isOpeningCase} className="record-button is-primary">
              {isOpeningCase ? "Abriendo…" : "Abrir caso"}
            </button>
          </div>
        </form>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">Sin caso de seguimiento activo.</p>
      )}

      {resolvedCases.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Casos anteriores</h3>
          <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-surface-1">
            {resolvedCases.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.reason}</span>
                <span className="text-xs text-muted-foreground">
                  Resuelto {formatDate(item.resolvedAt)} · {item.responsibleName}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
