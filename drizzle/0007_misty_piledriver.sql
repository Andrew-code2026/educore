-- Tablas de asistencia. Idempotente: ensureAttendanceTables (server/db.ts) crea las mismas tablas
-- al primer uso, así que en bases existentes ya pueden estar. Mantén este SQL igual a esa función.
CREATE TABLE IF NOT EXISTS `attendance_records` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL,
	`reason` text,
	`recordedByUserId` int DEFAULT NULL,
	`recordedByName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`modifiedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	UNIQUE KEY `attendance_course_student_date_uq` (`schoolId`,`courseId`,`studentId`,`attendanceDate`),
	KEY `attendance_course_date_idx` (`schoolId`,`courseId`,`attendanceDate`),
	KEY `attendance_student_date_idx` (`schoolId`,`studentId`,`attendanceDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_follow_up_cases` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_review','resolved') NOT NULL DEFAULT 'open',
	`responsibleUserId` int DEFAULT NULL,
	`responsibleName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`resolvedAt` timestamp NULL DEFAULT NULL,
	PRIMARY KEY (`id`),
	KEY `follow_up_course_status_idx` (`schoolId`,`courseId`,`status`),
	KEY `follow_up_student_idx` (`schoolId`,`studentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_follow_up_notes` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL DEFAULT 1,
	`caseId` int NOT NULL,
	`note` text NOT NULL,
	`authorUserId` int DEFAULT NULL,
	`authorName` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `follow_up_notes_case_created_idx` (`caseId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_justifications` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL DEFAULT 1,
	`courseId` varchar(64) NOT NULL,
	`studentId` varchar(64) NOT NULL,
	`attendanceDate` timestamp NOT NULL,
	`reasonCategory` enum('medical','family_emergency','external_appointment','institutional','force_majeure','other') NOT NULL DEFAULT 'other',
	`description` text NOT NULL,
	`submittedByRole` enum('student','guardian','teacher') NOT NULL,
	`submittedByName` varchar(160) NOT NULL,
	`submittedByUserId` int DEFAULT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`digitalEvidenceUrl` text DEFAULT NULL,
	`digitalEvidenceName` varchar(255) DEFAULT NULL,
	`requiresPhysicalSupport` boolean NOT NULL DEFAULT FALSE,
	`physicalSupportDeadline` timestamp NULL DEFAULT NULL,
	`physicalSupportReceivedAt` timestamp NULL DEFAULT NULL,
	`physicalSupportReceivedByName` varchar(160) DEFAULT NULL,
	`physicalSupportReceivedByUserId` int DEFAULT NULL,
	`physicalSupportNotes` text DEFAULT NULL,
	`status` enum('absence_registered','scheduled_absence','submitted','pending_physical_support','in_review','approved','unjustified','rejected') NOT NULL DEFAULT 'submitted',
	`escalatedToCoordination` boolean NOT NULL DEFAULT FALSE,
	`coordinationNotes` text DEFAULT NULL,
	`resolutionNotes` text DEFAULT NULL,
	`resolvedAt` timestamp NULL DEFAULT NULL,
	`resolvedByUserId` int DEFAULT NULL,
	`resolvedByName` varchar(160) DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `justification_course_status_idx` (`schoolId`,`courseId`,`status`),
	KEY `justification_student_date_idx` (`schoolId`,`studentId`,`attendanceDate`),
	UNIQUE KEY `justification_student_course_date_uniq` (`schoolId`,`courseId`,`studentId`,`attendanceDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance_justification_events` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL DEFAULT 1,
	`justificationId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`fromStatus` varchar(64) DEFAULT NULL,
	`toStatus` varchar(64) DEFAULT NULL,
	`actorRole` varchar(64) NOT NULL,
	`actorName` varchar(160) NOT NULL,
	`actorUserId` int DEFAULT NULL,
	`notes` text DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `justification_events_justification_idx` (`justificationId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
