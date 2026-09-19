import type React from "react";
import type { Section } from "@/components/shell";

export interface TeacherMetricItem {
  id: string;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export interface TeacherAgendaItem {
  id: string;
  type: "event" | "assignment_due" | "activity";
  timeOrDate: string;
  title: string;
  subtitle?: string;
  isToday: boolean;
  tag?: string;
  tagTone?: "neutral" | "info" | "warning" | "danger" | "success";
  onClick?: () => void;
}

export interface TeacherPriorityItem {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  context: string;
  count?: number;
  actionLabel: string;
  onAction: () => void;
}

export interface TeacherGradingItem {
  assignmentId: number;
  title: string;
  course: string;
  subject: string;
  pendingCount: number;
  totalSubmissions: number;
  dueAt?: Date | string | null;
  onGrade: () => void;
}

export interface TeacherStudentAlert {
  studentId?: number;
  name: string;
  course: string;
  subject?: string;
  currentGrade: number;
  reason: string;
  avatarColor?: string;
  onOpenGradeCenter: () => void;
}

export interface TeacherQuickActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isHighlighted?: boolean;
  onClick: () => void;
}

export interface TeacherCourseCardItem {
  id?: number | string;
  name: string;
  studentCount: number;
  averageGrade: number;
  pendingCount: number;
  progress: number;
  tone?: string;
  onClick?: () => void;
}

export interface QuickAnalyticsItem {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
}

export interface TeacherDashboardProps {
  data: any;
  user?: any;
  setSection: (section: Section) => void;
}
