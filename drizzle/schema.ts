import { double, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  schoolId: int("schoolId"),
  name: text("name"),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const schoolMemberships = mysqlTable("school_memberships", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  userId: int("userId").notNull(),
  roleKey: varchar("roleKey", { length: 40 }).notNull().default("STUDENT"),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ membershipUnique: uniqueIndex("school_memberships_school_user_unique").on(table.schoolId, table.userId) }));

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description").notNull(),
  hierarchyLevel: int("hierarchyLevel").notNull().default(0),
});

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  module: varchar("module", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
});

export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleId: int("roleId").notNull(),
  permissionId: int("permissionId").notNull(),
}, table => ({ rolePermissionUnique: uniqueIndex("role_permissions_role_permission_unique").on(table.roleId, table.permissionId) }));

export const teacherProfiles = mysqlTable("teacher_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  schoolId: int("schoolId").notNull(),
  employeeCode: varchar("employeeCode", { length: 60 }),
  specialties: text("specialties"),
  subjects: text("subjects"),
}, table => ({ teacherUnique: uniqueIndex("teacher_profiles_school_user_unique").on(table.schoolId, table.userId) }));

export const studentProfiles = mysqlTable("student_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  schoolId: int("schoolId").notNull(),
  studentCode: varchar("studentCode", { length: 60 }),
  gradeLevel: varchar("gradeLevel", { length: 20 }),
  course: varchar("course", { length: 60 }),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
}, table => ({ studentUnique: uniqueIndex("student_profiles_school_user_unique").on(table.schoolId, table.userId) }));

export const guardianProfiles = mysqlTable("guardian_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  schoolId: int("schoolId").notNull(),
}, table => ({ guardianUnique: uniqueIndex("guardian_profiles_school_user_unique").on(table.schoolId, table.userId) }));

export const guardianStudentRelationships = mysqlTable("guardian_student_relationships", {
  id: int("id").autoincrement().primaryKey(),
  guardianUserId: int("guardianUserId").notNull(),
  studentUserId: int("studentUserId").notNull(),
  schoolId: int("schoolId").notNull(),
  relationshipType: varchar("relationshipType", { length: 30 }).notNull().default("PARENT"),
  isPrimary: int("isPrimary").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ relationshipUnique: uniqueIndex("guardian_student_school_unique").on(table.guardianUserId, table.studentUserId, table.schoolId) }));

export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  roleKey: varchar("roleKey", { length: 40 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  expiresAt: timestamp("expiresAt").notNull(),
  invitedBy: int("invitedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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

export const academicYears = mysqlTable("academic_years", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  year: int("year").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ yearUnique: uniqueIndex("academic_years_school_year_unique").on(table.schoolId, table.year) }));

export const academicPeriods = mysqlTable("academic_periods", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  academicYearId: int("academicYearId"),
  name: varchar("name", { length: 80 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("Activo"),
  orderIndex: int("orderIndex").notNull().default(1),
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
  academicYearId: int("academicYearId"),
  gradeLevelId: int("gradeLevelId"),
  name: varchar("name", { length: 60 }).notNull(),
  code: varchar("code", { length: 30 }),
  grade: varchar("grade", { length: 20 }).notNull(),
  groupName: varchar("groupName", { length: 10 }).notNull(),
  year: varchar("year", { length: 20 }).notNull(),
  capacity: int("capacity"),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
  studentsCount: int("studentsCount").notNull().default(0),
  average: double("average").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  shortName: varchar("shortName", { length: 40 }),
  code: varchar("code", { length: 30 }),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  course: varchar("course", { length: 60 }).notNull(),
  teacherName: varchar("teacherName", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gradeLevels = mysqlTable("grade_levels", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  shortName: varchar("shortName", { length: 20 }).notNull(),
  levelOrder: int("levelOrder").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
}, table => ({ gradeUnique: uniqueIndex("grade_levels_school_short_unique").on(table.schoolId, table.shortName) }));

export const courseSubjects = mysqlTable("course_subjects", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  courseId: int("courseId").notNull(),
  subjectId: int("subjectId").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ courseSubjectUnique: uniqueIndex("course_subjects_school_course_subject_unique").on(table.schoolId, table.courseId, table.subjectId) }));

export const teacherAssignments = mysqlTable("teacher_assignments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  teacherUserId: int("teacherUserId").notNull(),
  courseId: int("courseId").notNull(),
  subjectId: int("subjectId").notNull(),
  academicYearId: int("academicYearId").notNull(),
  isPrimary: int("isPrimary").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ assignmentUnique: uniqueIndex("teacher_assignments_school_unique").on(table.schoolId, table.teacherUserId, table.courseId, table.subjectId, table.academicYearId) }));

export const studentEnrollments = mysqlTable("student_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  studentUserId: int("studentUserId").notNull(),
  academicYearId: int("academicYearId").notNull(),
  courseId: int("courseId").notNull(),
  enrollmentStatus: varchar("enrollmentStatus", { length: 20 }).notNull().default("ACTIVE"),
  enrollmentDate: timestamp("enrollmentDate").defaultNow().notNull(),
  withdrawalDate: timestamp("withdrawalDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ enrollmentUnique: uniqueIndex("student_enrollments_school_student_year_course_unique").on(table.schoolId, table.studentUserId, table.academicYearId, table.courseId) }));

export const enrollmentHistory = mysqlTable("enrollment_history", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull(),
  enrollmentId: int("enrollmentId").notNull(),
  studentUserId: int("studentUserId").notNull(),
  fromCourseId: int("fromCourseId"),
  toCourseId: int("toCourseId").notNull(),
  changedByUserId: int("changedByUserId").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  reason: text("reason"),
});

export const gradingScales = mysqlTable("grading_scales", {
	id: int("id").autoincrement().primaryKey(),
	schoolId: int("schoolId").notNull(),
	name: varchar("name", { length: 80 }).notNull(),
	minValue: double("minValue").notNull().default(0),
	maxValue: double("maxValue").notNull().default(5),
	decimalPlaces: int("decimalPlaces").notNull().default(1),
	status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
	createdAt: timestamp("createdAt").defaultNow().notNull(),
	updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ scaleUnique: uniqueIndex("grading_scales_school_name_unique").on(table.schoolId, table.name) }));

export const assessments = mysqlTable("assessments", {
	id: int("id").autoincrement().primaryKey(),
	schoolId: int("schoolId").notNull(),
	academicYearId: int("academicYearId").notNull(),
	academicPeriodId: int("academicPeriodId").notNull(),
	courseId: int("courseId").notNull(),
	subjectId: int("subjectId").notNull(),
	teacherId: int("teacherId").notNull(),
	title: varchar("title", { length: 180 }).notNull(),
	description: text("description"),
	assessmentType: varchar("assessmentType", { length: 30 }).notNull().default("ACTIVIDAD"),
	date: timestamp("date").notNull(),
	maxValue: double("maxValue").notNull().default(5),
	weight: double("weight").notNull().default(0),
	status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
	createdAt: timestamp("createdAt").defaultNow().notNull(),
	updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assessmentGrades = mysqlTable("assessment_grades", {
	id: int("id").autoincrement().primaryKey(),
	schoolId: int("schoolId").notNull(),
	assessmentId: int("assessmentId").notNull(),
	studentId: int("studentId").notNull(),
	studentEnrollmentId: int("studentEnrollmentId").notNull(),
	courseId: int("courseId").notNull(),
	subjectId: int("subjectId").notNull(),
	academicYearId: int("academicYearId").notNull(),
	academicPeriodId: int("academicPeriodId").notNull(),
	value: double("value"),
	comment: text("comment"),
	status: varchar("status", { length: 20 }).notNull().default("RECORDED"),
	createdAt: timestamp("createdAt").defaultNow().notNull(),
	updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ gradeUnique: uniqueIndex("assessment_grades_assessment_student_unique").on(table.assessmentId, table.studentId) }));

export const academicObservations = mysqlTable("academic_observations", {
	id: int("id").autoincrement().primaryKey(),
	schoolId: int("schoolId").notNull(),
	studentId: int("studentId").notNull(),
	academicYearId: int("academicYearId").notNull(),
	academicPeriodId: int("academicPeriodId").notNull(),
	assessmentId: int("assessmentId"),
	text: text("text").notNull(),
	status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
	createdByUserId: int("createdByUserId").notNull(),
	createdAt: timestamp("createdAt").defaultNow().notNull(),
	updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reportCardRuns = mysqlTable("report_card_runs", {
	id: int("id").autoincrement().primaryKey(),
	schoolId: int("schoolId").notNull(),
	academicYearId: int("academicYearId").notNull(),
	academicPeriodId: int("academicPeriodId").notNull(),
	courseId: int("courseId").notNull(),
	studentId: int("studentId").notNull(),
	status: varchar("status", { length: 20 }).notNull().default("READY"),
	generatedAt: timestamp("generatedAt").defaultNow().notNull(),
	createdByUserId: int("createdByUserId").notNull(),
	dataJson: text("dataJson").notNull(),
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
  actorUserId: int("actorUserId"),
  targetUserId: int("targetUserId"),
  targetType: varchar("targetType", { length: 50 }),
  actorRole: varchar("actorRole", { length: 30 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
