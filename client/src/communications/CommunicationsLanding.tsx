import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Inbox, Search, SearchX, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  filterAnnouncements,
  type AnnouncementModel,
  type CommunicationsModel,
  type ComposeAbilities,
  type StatusFilter,
} from "./landing";
import { LandingHeader } from "./LandingHeader";
import { AnnouncementList } from "./AnnouncementList";
import { ComposeDialog, type ComposeInput } from "./ComposeDialog";
import "./communications.css";

interface CommunicationsLandingProps {
  model: CommunicationsModel;
  academicYear: string;
  period: string | null;
  lede: string;
  abilities: ComposeAbilities;
  busyId: number | null;
  saving: boolean;
  aiPending: boolean;
  onCompose: (input: ComposeInput) => Promise<void>;
  onDraftWithAi: (draft: { title: string; message: string }) => Promise<{ title: string | null; message: string }>;
  onPublish: (item: AnnouncementModel) => void;
  onDelete: (item: AnnouncementModel) => void;
  onCopy: (item: AnnouncementModel) => void;
}

const FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Publicados" },
  { id: "draft", label: "Borradores" },
];

/** Portada de Comunicaciones: resumen, filtros y comunicados del colegio. */
export function CommunicationsLanding({
  model,
  academicYear,
  period,
  lede,
  abilities,
  busyId,
  saving,
  aiPending,
  onCompose,
  onDraftWithAi,
  onPublish,
  onDelete,
  onCopy,
}: CommunicationsLandingProps) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AnnouncementModel | null>(null);

  const handleCompose = async (input: ComposeInput) => {
    await onCompose(input);
    setComposeOpen(false);
  };

  return (
    <div className="cmn">
      <div aria-hidden="true" className="cmn__glow cmn__glow--a" />
      <div aria-hidden="true" className="cmn__glow cmn__glow--b" />

      <div className="cmn__content">
        <LandingHeader
          academicYear={academicYear}
          period={period}
          lede={lede}
          summary={model.summary}
          canCompose={abilities.canCompose}
          onCompose={() => setComposeOpen(true)}
        />

        <AnnouncementsSection
          announcements={model.announcements}
          abilities={abilities}
          busyId={busyId}
          onPublish={onPublish}
          onCopy={onCopy}
          onDelete={setPendingDelete}
        />
      </div>

      {abilities.canCompose && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          canSend={abilities.canSend}
          saving={saving}
          aiPending={aiPending}
          onSubmit={handleCompose}
          onDraftWithAi={onDraftWithAi}
        />
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pendingDelete?.title}» dejará de estar disponible para{" "}
              {pendingDelete?.audience.toLowerCase()}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => pendingDelete && onDelete(pendingDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AnnouncementsSectionProps {
  announcements: AnnouncementModel[];
  abilities: ComposeAbilities;
  busyId: number | null;
  onPublish: (item: AnnouncementModel) => void;
  onCopy: (item: AnnouncementModel) => void;
  onDelete: (item: AnnouncementModel) => void;
}

function AnnouncementsSection({ announcements, abilities, busyId, onPublish, onCopy, onDelete }: AnnouncementsSectionProps) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const drafts = announcements.filter((item) => item.status === "draft").length;
    return { all: announcements.length, published: announcements.length - drafts, draft: drafts };
  }, [announcements]);
  // Solo quien redacta tiene borradores que separar; si ya no quedan, el filtro vuelve a "Todos"
  const showSegment = abilities.canCompose && counts.draft > 0;
  const activeStatus: StatusFilter = showSegment ? status : "all";
  const shown = useMemo(
    () => filterAnnouncements(announcements, { status: activeStatus, query: deferredQuery }),
    [announcements, activeStatus, deferredQuery],
  );

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <section aria-labelledby="cmn-list-heading" className="cmn-section">
      <div className="cmn-section__head">
        <h2 id="cmn-list-heading" className="cmn-section__title">
          Comunicados
          {announcements.length > 0 && <span className="cmn-count cmn-num">{announcements.length}</span>}
        </h2>

        {announcements.length > 0 && (
          <div className="cmn-toolbar">
            <div className="cmn-search">
              <Search aria-hidden="true" strokeWidth={1.9} />
              <label htmlFor="cmn-search" className="cmn-sr">
                Buscar comunicados
              </label>
              <input
                id="cmn-search"
                type="search"
                value={query}
                placeholder="Buscar por título, mensaje o público"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" className="cmn-search__clear" aria-label="Limpiar búsqueda" onClick={() => setQuery("")}>
                  <X aria-hidden="true" strokeWidth={2} />
                </button>
              )}
            </div>

            {showSegment && (
              <div role="group" aria-label="Filtrar por estado" className="cmn-segment">
                {FILTERS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeStatus === id}
                    className={cn("cmn-segment__btn", activeStatus === id && "is-active")}
                    onClick={() => setStatus(id)}
                  >
                    {label}
                    <span className="cmn-segment__count cmn-num">{counts[id]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {announcements.length === 0 ? (
        <EmptyCard icon={<Inbox strokeWidth={1.9} />} title="Aún no hay comunicados">
          {abilities.canCompose
            ? "Crea el primero con «Nuevo comunicado»; podrás guardarlo como borrador antes de enviarlo."
            : "Cuando el colegio publique avisos o circulares para ti, aparecerán aquí."}
        </EmptyCard>
      ) : shown.length === 0 ? (
        <EmptyCard
          icon={<SearchX strokeWidth={1.9} />}
          title="Ningún comunicado coincide"
          action={
            <button type="button" className="cmn-btn cmn-btn--outline cmn-empty__action" onClick={clearFilters}>
              Limpiar filtros
            </button>
          }
        >
          Prueba con otras palabras o revisa el filtro de estado.
        </EmptyCard>
      ) : (
        <>
          <p className="cmn-sr" role="status">
            {deferredQuery ? `${shown.length} resultados` : ""}
          </p>
          <AnnouncementList
            announcements={shown}
            canSend={abilities.canSend}
            busyId={busyId}
            onPublish={onPublish}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        </>
      )}
    </section>
  );
}

interface EmptyCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

function EmptyCard({ icon, title, children, action }: EmptyCardProps) {
  return (
    <div className="cmn-surface cmn-empty" role="status">
      <span aria-hidden="true" className="cmn-empty__icon">
        {icon}
      </span>
      <div className="cmn-empty__body">
        <span className="cmn-empty__title">{title}</span>
        <span className="cmn-empty__text">{children}</span>
      </div>
      {action}
    </div>
  );
}
