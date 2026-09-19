import type * as React from "react";

export type EduRole = "admin" | "teacher" | "student" | "guardian";

export type Section =
  | "overview"
  | "academic"
  | "grades"
  | "classroom"
  | "attendance"
  | "calendar"
  | "communications"
  | "reports"
  | "ai"
  | "users"
  | "settings";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isCurrent?: boolean;
}

export interface ContextPill {
  label: string;
  detail?: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose" | "violet";
}

export interface ModuleAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "ghost" | "accent";
  onClick: () => void;
  disabled?: boolean;
  isPending?: boolean;
}

export interface ModuleContext {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  contextPills?: ContextPill[];
  actions?: React.ReactNode;
}

export interface NavItem {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: EduRole[];
  groupKey: string;
  mobilePriority: "bottom" | "more";
  badge?: number | string;
  description?: string;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export interface EduCoreShellProps {
  children: React.ReactNode;
  role: EduRole;
  section: Section;
  setSection: (section: Section) => void;
  schoolName: string;
  school: any;
  user?: any;
  onRoleChange: (role: EduRole) => void;
  onLogout: () => void;
  notificationCount?: number;
}
