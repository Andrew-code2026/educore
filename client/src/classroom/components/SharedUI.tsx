import type { ReactNode } from 'react';
import type { ActivityStatus, SubmissionStatus } from '../types';

export const Icon = ({ name, size = 18, stroke = 1.8 }: { name: string; size?: number; stroke?: number }) => {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8 9h8M8 13h6M8 17h4" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 11h5" /></>,
    users: <><path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3" /><path d="M17 11a3 3 0 1 0-1.2-5.75M18 15.2a3.5 3.5 0 0 1 3 3.3V20" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    down: <path d="m6 9 6 6 6-6" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    sort: <><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    spark: <><path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" /><path d="m19 16 .55 2.45L22 19l-2.45.55L19 22l-.55-2.45L16 19l2.45-.55L19 16Z" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" /><path d="m3 8 5-5M16 3l5 5M3 16l5 5M16 21l5-5" /></>,
    undo: <><path d="M9 7 4 12l5 5" /><path d="M5 12h9a5 5 0 0 1 5 5v1" /></>,
    lightning: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
    message: <><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.3A2.5 2.5 0 0 1 5 12.5v-7Z" /><path d="M8 8h8M8 11h5" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
    alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
};

export function StatusPill({ status }: { status: ActivityStatus | SubmissionStatus | string }) {
  const tone =
    status === 'Por revisar' || status === 'Por calificar'
      ? 'review'
      : status === 'En curso' || status === 'Publicada' || status === 'Entregada'
      ? 'active'
      : status === 'Cerrada' || status === 'Calificada'
      ? 'closed'
      : status === 'Borrador'
      ? 'draft'
      : 'next';
  return (
    <span className={`status-pill ${tone}`}>
      <i />
      {status}
    </span>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Metric({
  value,
  label,
  delta,
  tone = 'cyan',
  icon,
}: {
  value: string;
  label: string;
  delta?: string;
  tone?: string;
  icon: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon name={icon} size={18} />
      </div>
      <div className="metric-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        {delta && <em>{delta}</em>}
      </div>
    </div>
  );
}

export function AvatarStack({ count = 4 }: { count?: number }) {
  const colors = ['#64e8ff', '#a78bfa', '#fbbf6b', '#70e0b2', '#f88fb2'];
  return (
    <div className="avatar-stack">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} style={{ background: colors[index % colors.length] }}>
          {['AT', 'CM', 'SR', 'JP', 'VG'][index]}
        </span>
      ))}
      {count < 10 && <b>+{count * 7}</b>}
    </div>
  );
}

export function ProgressBar({ value, color = 'cyan' }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span className={`progress-fill ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}
