CREATE TABLE `attendance_follow_up_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_review','resolved') NOT NULL DEFAULT 'open',
	`responsibleUserId` int,
	`responsibleName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp,
	CONSTRAINT `attendance_follow_up_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_follow_up_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL DEFAULT 1,
	`caseId` int NOT NULL,
	`note` text NOT NULL,
	`authorUserId` int,
	`authorName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_follow_up_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_justification_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL DEFAULT 1,
	`justificationId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`fromStatus` varchar(64),
	`toStatus` varchar(64),
	`actorRole` varchar(64) NOT NULL,
	`actorName` varchar(160) NOT NULL,
	`actorUserId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_justification_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_justifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`reasonCategory` enum('medical','family_emergency','external_appointment','institutional','force_majeure','other') NOT NULL DEFAULT 'other',
	`description` text NOT NULL,
	`submittedByRole` enum('student','guardian','teacher') NOT NULL,
	`submittedByName` varchar(160) NOT NULL,
	`submittedByUserId` int,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`digitalEvidenceUrl` text,
	`digitalEvidenceName` varchar(255),
	`requiresPhysicalSupport` boolean NOT NULL DEFAULT false,
	`physicalSupportDeadline` timestamp,
	`physicalSupportReceivedAt` timestamp,
	`physicalSupportReceivedByName` varchar(160),
	`physicalSupportReceivedByUserId` int,
	`physicalSupportNotes` text,
	`status` enum('absence_registered','scheduled_absence','submitted','pending_physical_support','in_review','approved','unjustified','rejected') NOT NULL DEFAULT 'submitted',
	`escalatedToCoordination` boolean NOT NULL DEFAULT false,
	`coordinationNotes` text,
	`resolutionNotes` text,
	`resolvedAt` timestamp,
	`resolvedByUserId` int,
	`resolvedByName` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_justifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `justification_student_course_date_uniq` UNIQUE(`schoolId`,`courseId`,`studentId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL,
	`reason` text,
	`recordedByUserId` int,
	`recordedByName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`modifiedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_course_student_date_uq` UNIQUE(`schoolId`,`courseId`,`studentId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE INDEX `follow_up_course_status_idx` ON `attendance_follow_up_cases` (`schoolId`,`courseId`,`status`);--> statement-breakpoint
CREATE INDEX `follow_up_student_idx` ON `attendance_follow_up_cases` (`schoolId`,`studentId`);--> statement-breakpoint
CREATE INDEX `follow_up_notes_case_created_idx` ON `attendance_follow_up_notes` (`caseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `justification_events_justification_idx` ON `attendance_justification_events` (`justificationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `justification_course_status_idx` ON `attendance_justifications` (`schoolId`,`courseId`,`status`);--> statement-breakpoint
CREATE INDEX `justification_student_date_idx` ON `attendance_justifications` (`schoolId`,`studentId`,`attendanceDate`);--> statement-breakpoint
CREATE INDEX `attendance_course_date_idx` ON `attendance_records` (`schoolId`,`courseId`,`attendanceDate`);--> statement-breakpoint
CREATE INDEX `attendance_student_date_idx` ON `attendance_records` (`schoolId`,`studentId`,`attendanceDate`);