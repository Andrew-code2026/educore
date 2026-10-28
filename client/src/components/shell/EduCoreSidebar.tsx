import React from "react";
import type { EduRole, NavItem, Section } from "./shell.types";
import { getNavGroupsForRole, ROLE_LABELS } from "./navigation";
import { useShellContext } from "./ShellContext";

interface EduCoreSidebarProps {
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  school: any;
  schoolName: string;
  onLogout: () => void;
  notificationCount?: number;
  user?: any;
}

const getRoleAvatarInitials = (role: EduRole, user?: any) => {
  if (role === "teacher" && user?.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  switch (role) {
    case "admin":
      return "RC";
    case "teacher":
      return "JD";
    case "guardian":
      return "MM";
    case "student":
      return "SM";
  }
};

// Trazos de iconos del diseño (24×24, stroke). Las secciones sin trazo propio usan su icono lucide.
const rect = (x: number, y: number, w: number, h: number, r: number) =>
  ["M", x + r, y, "h", w - 2 * r, "a", r, r, 0, 0, 1, r, r, "v", h - 2 * r, "a", r, r, 0, 0, 1, -r, r, "h", -(w - 2 * r), "a", r, r, 0, 0, 1, -r, -r, "v", -(h - 2 * r), "a", r, r, 0, 0, 1, r, -r, "z"].join(" ");
const CLIPBOARD = rect(8, 2, 8, 4, 1) + "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2";

const NAV_ICON_PATHS: Partial<Record<Section, string>> = {
  overview: rect(3, 3, 7, 7, 1.5) + rect(14, 3, 7, 7, 1.5) + rect(14, 14, 7, 7, 1.5) + rect(3, 14, 7, 7, 1.5),
  grades: "M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3",
  classroom: CLIPBOARD + "M12 11h4M12 16h4M8 11h.01M8 16h.01",
  attendance: CLIPBOARD + "M9 14l2 2 4-4",
  analytics: "M22 12h-4l-3 9L9 3l-3 9H2",
  calendar: rect(3, 4, 18, 18, 2) + "M16 2v4M8 2v4M3 10h18",
  reports: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M8 18v-2M12 18v-6M16 18v-4",
  communications: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6",
  piar: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2M14 2v4a2 2 0 0 0 2 2h4M10.29 10.7a2.43 2.43 0 0 0-2.66-.52c-.29.12-.56.3-.78.53l-.35.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L6.5 18l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z",
};

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SHORTCUT_LABEL = IS_MAC ? "⌘B" : "Ctrl B";
const TIP_DELAY = 350;
const TIP_WARM_WINDOW = 400;

export function NavIcon({ item }: { item: NavItem }) {
  const d = NAV_ICON_PATHS[item.id];
  if (!d) {
    const Icon = item.icon;
    return <Icon className="h-[18px] w-[18px]" />;
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

interface TipState {
  open: boolean;
  label: string;
  badge: string;
  kbd: string;
  x: number;
  y: number;
}

// Tooltips: solo en el riel salvo data-tip-always; con retardo la primera vez e inmediatos mientras están "tibios".
function useRailTooltip(collapsed: boolean) {
  const [tip, setTip] = React.useState<TipState>({ open: false, label: "", badge: "", kbd: "", x: 0, y: 0 });
  const timer = React.useRef<number>(0);
  const closedAt = React.useRef(0);
  const openRef = React.useRef(false);
  openRef.current = tip.open;

  const show = React.useCallback(
    (el: HTMLElement, immediate: boolean) => {
      if (!collapsed && el.dataset.tipAlways !== "true") return;
      window.clearTimeout(timer.current);
      const r = el.getBoundingClientRect();
      const next: TipState = {
        open: true,
        label: el.dataset.tip || "",
        badge: el.dataset.tipBadge || "",
        kbd: el.dataset.tipKbd || "",
        x: Math.round(r.right + 10),
        y: Math.round(r.top + r.height / 2),
      };
      const warm = openRef.current || Date.now() - closedAt.current < TIP_WARM_WINDOW;
      if (immediate || warm) setTip(next);
      else timer.current = window.setTimeout(() => setTip(next), TIP_DELAY);
    },
    [collapsed]
  );

  const hide = React.useCallback((reset?: boolean) => {
    window.clearTimeout(timer.current);
    if (!openRef.current) return;
    closedAt.current = reset ? 0 : Date.now();
    setTip(prev => ({ ...prev, open: false }));
  }, []);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget, false),
    onMouseLeave: () => hide(),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget, true);
    },
    onBlur: () => hide(),
  };

  return { tip, hide, handlers };
}

export function EduCoreSidebar({
  role,
  section,
  setSection,
  school,
  schoolName,
  onLogout,
  notificationCount = 0,
  user,
}: EduCoreSidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useShellContext();
  const groups = getNavGroupsForRole(role, notificationCount);
  const navRef = React.useRef<HTMLElement>(null);
  const [indicator, setIndicator] = React.useState({ y: 0, visible: false, ready: false });
  const { tip, hide: hideTip, handlers: tipHandlers } = useRailTooltip(sidebarCollapsed);

  const handleToggle = React.useCallback(() => {
    hideTip(true);
    toggleSidebar();
  }, [hideTip, toggleSidebar]);

  // Atajo de teclado (Ctrl+B / ⌘+B) para plegar/desplegar el menú
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b" && !isTyping) {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggle]);

  // Indicador activo compartido: la primera colocación es instantánea, los cambios posteriores se animan.
  React.useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el) {
      setIndicator(prev => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    setIndicator(prev => (prev.y === el.offsetTop && prev.visible ? prev : { ...prev, y: el.offsetTop, visible: true }));
  }, [section, role, sidebarCollapsed]);

  React.useEffect(() => {
    if (!indicator.visible || indicator.ready) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIndicator(prev => ({ ...prev, ready: true })));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [indicator.visible, indicator.ready]);

  const displayName = role === "teacher" ? (user?.name || "Juan Diego Loaiza") : role === "admin" ? "Rectoría / Admin" : ROLE_LABELS[role];

  return (
    <aside className="edc-side edc-chrome" aria-label="Barra lateral" data-collapsed={sidebarCollapsed}>
      <div className="edc-side__brand">
        <div className="edc-logo" aria-hidden="true">
          <div className="edc-logo__glyph" />
        </div>
        <div className="edc-side__brand-text edc-fade">
          <span className="edc-side__wordmark">EDUCORE</span>
          <span className="edc-side__school">{schoolName}</span>
        </div>
        <button
          type="button"
          className="edc-icon-btn"
          onClick={handleToggle}
          aria-label="Plegar menú"
          aria-controls="educore-nav"
          aria-expanded="true"
          data-tip="Plegar menú"
          data-tip-kbd={SHORTCUT_LABEL}
          data-tip-always="true"
          {...tipHandlers}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m16 15-3-3 3-3" />
          </svg>
        </button>
        <button
          type="button"
          className="edc-side__expand"
          onClick={handleToggle}
          aria-label="Desplegar menú"
          aria-controls="educore-nav"
          aria-expanded="false"
          data-tip="Desplegar menú"
          data-tip-kbd={SHORTCUT_LABEL}
          {...tipHandlers}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m14 9 3 3-3 3" />
          </svg>
        </button>
      </div>

      <nav id="educore-nav" ref={navRef} className="edc-nav-list" aria-label="Principal">
        {indicator.visible && (
          <div
            aria-hidden="true"
            className="edc-nav-indicator"
            style={{
              opacity: indicator.ready ? 1 : 0,
              transform: `translateY(${indicator.y}px)`,
              transition: indicator.ready ? "transform .32s cubic-bezier(.2,0,0,1), opacity .2s ease" : "none",
            }}
          />
        )}
        {groups.map(group => {
          const headId = `nav-h-${group.key}`;
          return (
            <div key={group.key} role="group" aria-labelledby={headId} className="edc-nav-group">
              <div className="edc-nav-group__head">
                <span id={headId} className="edc-nav-group__label edc-fade">{group.label}</span>
                <span aria-hidden="true" className="edc-nav-group__rule" />
              </div>
              {group.items.map(item => {
                const isActive = section === item.id;
                const hasBadge = item.badge !== undefined;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="edc-nav-item"
                    onClick={() => {
                      hideTip(true);
                      setSection(item.id);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={hasBadge ? `${item.label}, ${item.badge} sin leer` : item.label}
                    data-tip={item.label}
                    data-tip-badge={hasBadge ? String(item.badge) : ""}
                    {...tipHandlers}
                  >
                    <span className="edc-nav-item__icon">
                      <NavIcon item={item} />
                      {hasBadge && <span aria-hidden="true" className="edc-nav-item__dot" />}
                    </span>
                    <span className="edc-nav-item__label edc-fade">{item.label}</span>
                    {hasBadge && (
                      <span aria-hidden="true" className="edc-nav-item__badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="edc-side__footer">
        <div className="edc-side__user">
          <span
            aria-hidden="true"
            className="edc-side__avatar"
            data-tip={displayName}
            onMouseEnter={tipHandlers.onMouseEnter}
            onMouseLeave={tipHandlers.onMouseLeave}
          >
            {getRoleAvatarInitials(role, user)}
          </span>
          <div className="edc-side__user-text edc-fade">
            <span className="edc-side__user-name">{displayName}</span>
            <span className="edc-side__user-sub">{schoolName}</span>
          </div>
          <button
            type="button"
            className="edc-icon-btn"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            data-tip="Cerrar sesión"
            data-tip-always="true"
            {...tipHandlers}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="edc-tip"
        style={{
          left: tip.x,
          top: tip.y - 15,
          opacity: tip.open ? 1 : 0,
          transform: tip.open ? "translateX(0)" : "translateX(-4px)",
        }}
      >
        <span>{tip.label}</span>
        {tip.badge && <span className="edc-tip__badge">{tip.badge}</span>}
        {tip.kbd && <kbd>{tip.kbd}</kbd>}
      </div>
    </aside>
  );
}
