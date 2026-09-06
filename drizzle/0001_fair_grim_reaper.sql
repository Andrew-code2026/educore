CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userRole` varchar(30) NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`audience` varchar(120) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'Publicado',
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`course` varchar(60) NOT NULL,
	`teacherName` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`dueAt` timestamp NOT NULL,
	`points` int NOT NULL DEFAULT 100,
	`status` varchar(30) NOT NULL DEFAULT 'Publicado',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`course` varchar(60) NOT NULL,
	`date` timestamp NOT NULL,
	`status` varchar(30) NOT NULL,
	`note` text,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`actorRole` varchar(30) NOT NULL,
	`action` varchar(120) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`grade` varchar(20) NOT NULL,
	`groupName` varchar(10) NOT NULL,
	`year` varchar(20) NOT NULL,
	`teacherName` varchar(160) NOT NULL,
	`studentsCount` int NOT NULL DEFAULT 0,
	`average` double NOT NULL DEFAULT 0,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`type` varchar(60) NOT NULL,
	`eventDate` timestamp NOT NULL,
	`location` varchar(180),
	`audience` varchar(120) NOT NULL,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`course` varchar(60) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`period` varchar(40) NOT NULL,
	`value` double NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`detail` text NOT NULL,
	`type` varchar(40) NOT NULL,
	`read` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `planning` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`teacherName` varchar(160) NOT NULL,
	`title` varchar(180) NOT NULL,
	`topic` varchar(160) NOT NULL,
	`content` text NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'Borrador',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planning_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`course` varchar(60) NOT NULL,
	`period` varchar(40) NOT NULL,
	`average` double NOT NULL,
	`attendancePercent` double NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'Listo',
	CONSTRAINT `report_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`city` varchar(80) NOT NULL,
	`academicYear` varchar(20) NOT NULL,
	`tagline` varchar(255) NOT NULL,
	`primaryColor` varchar(20) NOT NULL,
	`secondaryColor` varchar(20) NOT NULL,
	`logoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(255) NOT NULL,
	`course` varchar(40) NOT NULL,
	`gradeLevel` varchar(20) NOT NULL,
	`guardianName` varchar(160) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'Activo',
	`avatarColor` varchar(20) NOT NULL DEFAULT '#dbeafe',
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`course` varchar(60) NOT NULL,
	`teacherName` varchar(160) NOT NULL,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`assignmentId` int NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`status` varchar(30) NOT NULL DEFAULT 'Entregada',
	`fileName` varchar(180),
	`comment` text,
	`grade` double,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(255) NOT NULL,
	`subjectFocus` varchar(120) NOT NULL,
	CONSTRAINT `teachers_id` PRIMARY KEY(`id`)
);
