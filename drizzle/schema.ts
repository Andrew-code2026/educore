import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  schoolId: int("schoolId"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  shortName: varchar("shortName", { length: 80 }).notNull().default("Gimnasio Moderno"),
  city: varchar("city", { length: 80 }).notNull(),
  department: varchar("department", { length: 100 }).notNull().default("Valle del Cauca"),
  country: varchar("country", { length: 80 }).notNull().default("Colombia"),
  description: text("description"),
  website: varchar("website", { length: 180 }).notNull().default("https://educore.co"),
  email: varchar("email", { length: 180 }).notNull().default("contacto@educore.co"),
  phone: varchar("phone", { length: 40 }).notNull().default("+57 602 555 0101"),
  address: varchar("address", { length: 180 }).notNull().default("Cali, Valle del Cauca"),
  academicYear: varchar("academicYear", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Activo"),
  tagline: varchar("tagline", { length: 255 }).notNull(),
  primaryColor: varchar("primaryColor", { length: 20 }).notNull(),
  secondaryColor: varchar("secondaryColor", { length: 20 }).notNull(),
  accentColor: varchar("accentColor", { length: 20 }).notNull().default("#8ec6fa"),
  backgroundColor: varchar("backgroundColor", { length: 20 }).notNull().default("#f7f9fc"),
  surfaceColor: varchar("surfaceColor", { length: 20 }).notNull().default("#ffffff"),
  textColor: varchar("textColor", { length: 20 }).notNull().default("#182131"),
  mutedTextColor: varchar("mutedTextColor", { length: 20 }).notNull().default("#7a8798"),
  fontFamily: varchar("fontFamily", { length: 120 }).notNull().default("system"),
  themeMode: varchar("themeMode", { length: 20 }).notNull().default("light"),
  borderRadius: varchar("borderRadius", { length: 20 }).notNull().default("12px"),
  faviconUrl: text("faviconUrl"),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const academicPeriods = mysqlTable("academic_periods", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Activo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  course: varchar("course", { length: 40 }).notNull(),
  gradeLevel: varchar("gradeLevel", { length: 20 }).notNull(),
  guardianName: varchar("guardianName", { length: 160 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Activo"),
  avatarColor: varchar("avatarColor", { length: 20 }).notNull().default("#dbeafe"),
});

export const teachers = mysqlTable("teachers", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  subjectFocus: varchar("subjectFocus", { length: 120 }).notNull(),
});

export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  grade: varchar("grade", { length: 20 }).notNull(),
  groupName: varchar("groupName", { length: 10 }).notNull(),
  year: varchar("year", { length: 20 }).notNull(),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
  studentsCount: int("studentsCount").notNull().default(0),
  average: double("average").notNull().default(0),
});

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  course: varchar("course", { length: 60 }).notNull(),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
});

export const grades = mysqlTable("grades", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  course: varchar("course", { length: 60 }).notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  period: varchar("period", { length: 40 }).notNull(),
  value: double("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  course: varchar("course", { length: 60 }).notNull(),
  date: timestamp("date").notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  note: text("note"),
});

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  course: varchar("course", { length: 60 }).notNull(),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
  description: text("description").notNull(),
  dueAt: timestamp("dueAt").notNull(),
  points: int("points").notNull().default(100),
  status: varchar("status", { length: 30 }).notNull().default("Publicado"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  assignmentId: int("assignmentId").notNull(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Entregada"),
  fileName: varchar("fileName", { length: 180 }),
  comment: text("comment"),
  grade: double("grade"),
});

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  eventDate: timestamp("eventDate").notNull(),
  location: varchar("location", { length: 180 }),
  audience: varchar("audience", { length: 120 }).notNull(),
});

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  audience: varchar("audience", { length: 120 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Publicado"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  detail: text("detail").notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  read: int("read").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const planning = mysqlTable("planning", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  topic: varchar("topic", { length: 160 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Borrador"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reportCards = mysqlTable("report_cards", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  course: varchar("course", { length: 60 }).notNull(),
  period: varchar("period", { length: 40 }).notNull(),
  average: double("average").notNull(),
  attendancePercent: double("attendancePercent").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Listo"),
});

export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  userRole: varchar("userRole", { length: 30 }).notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  actorRole: varchar("actorRole", { length: 30 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
