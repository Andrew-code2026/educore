import type { LucideIcon } from "lucide-react";
import type { Section, EduRole } from "@/components/shell/shell.types";

export interface StudentMetricItem {
  id: string;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  icon: LucideIcon;
  onClick?: () => void;
}

export interface StudentPendingAssignment {
  id: number;
  title: string;
  subject: string;
  course: string;
  dueAt: Date | string;
  formattedDue: string;
  urgency: "overdue" | "today" | "soon" | "later";
  urgencyLabel: string;
  points?: number;
  description?: string;
  teacherName?: string;
  hasSubmission: boolean;
  submissionStatus?: string;
  grade?: number | null;
  onAction: () => void;
}

export type MenPerformanceLevel = "Superior" | "Alto" | "Básico" | "Bajo";

export interface StudentSubjectSummary {
  name: string;
  teacherName?: string;
  average: number;
  performanceLevel: MenPerformanceLevel;
  pendingCount: number;
  evaluatedCount: number;
  totalAssessments: number;
  tone: "blue" | "violet" | "rose" | "amber" | "emerald";
  onOpenDetails: () => void;
}

export interface StudentAgendaItem {
  id: string;
  type: "event" | "assignment_due";
  timeOrDate: string;
  title: string;
  subtitle?: string;
  isToday: boolean;
  tag?: string;
  tagTone?: "neutral" | "info" | "warning" | "danger" | "success";
  onClick?: () => void;
}

export interface StudentAlertItem {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  context: string;
  actionLabel: string;
  onAction: () => void;
}

export interface StudentQuickActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  onClick: () => void;
}

export interface StudentDashboardProps {
  data: any;
  user?: any;
  role?: EduRole;
  setSection: (section: Section) => void;
  selectedStudentId?: number;
  onSelectStudent?: (id: number) => void;
}
