-- Tablas que el servidor crea al primer uso (ensureCourseResourcesTable, ensureCreatorTables,
-- ensurePiarTable) y la columna de ensureRuntimeColumns. Idempotente para que no falle en bases
-- donde ya existen. Mantén este SQL igual a esas funciones.
CREATE TABLE IF NOT EXISTS `course_resources` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL,
	`course` varchar(64) NOT NULL,
	`assignmentId` int DEFAULT NULL,
	`title` varchar(180) NOT NULL,
	`fileName` varchar(180) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`contentType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadedByUserId` int DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `course_resources_course_idx` (`schoolId`,`course`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `creator_resources` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`title` varchar(200) NOT NULL DEFAULT '',
	`kind` varchar(24) NOT NULL DEFAULT 'guia',
	`courseLabel` varchar(120) DEFAULT NULL,
	`subjectLabel` varchar(120) DEFAULT NULL,
	`gradeLabel` varchar(60) DEFAULT NULL,
	`prompt` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'generating',
	`errorMessage` varchar(500) DEFAULT NULL,
	`doc` mediumtext NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `creator_resources_owner_idx` (`schoolId`,`ownerUserId`,`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `creator_versions` (
	`id` int NOT NULL AUTO_INCREMENT,
	`resourceId` int NOT NULL,
	`schoolId` int NOT NULL,
	`version` int NOT NULL,
	`reason` varchar(16) NOT NULL,
	`label` varchar(200) NOT NULL DEFAULT '',
	`doc` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `creator_versions_resource_idx` (`resourceId`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `creator_messages` (
	`id` int NOT NULL AUTO_INCREMENT,
	`resourceId` int NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(12) NOT NULL,
	`content` text NOT NULL,
	`activity` text DEFAULT NULL,
	`inputTokens` int NOT NULL DEFAULT 0,
	`outputTokens` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `creator_messages_resource_idx` (`resourceId`,`id`),
	KEY `creator_messages_usage_idx` (`schoolId`,`userId`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `piar_records` (
	`id` int NOT NULL AUTO_INCREMENT,
	`schoolId` int NOT NULL,
	`studentUserId` int NOT NULL,
	`courseId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`data` mediumtext NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`createdByUserId` int DEFAULT NULL,
	`updatedByUserId` int DEFAULT NULL,
	`updatedByName` varchar(160) DEFAULT NULL,
	`finalizedAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	UNIQUE KEY `piar_records_school_student_year_unique` (`schoolId`,`studentUserId`,`academicYearId`),
	KEY `piar_records_course_idx` (`schoolId`,`courseId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- MySQL no admite ADD COLUMN IF NOT EXISTS: se arma el ALTER solo si falta la columna.
SET @educore_add_file_url = IF(
	(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'fileUrl') = 0,
	'ALTER TABLE `submissions` ADD COLUMN `fileUrl` varchar(512) NULL AFTER `fileName`',
	'DO 0'
);
--> statement-breakpoint
PREPARE educore_add_file_url FROM @educore_add_file_url;
--> statement-breakpoint
EXECUTE educore_add_file_url;
--> statement-breakpoint
DEALLOCATE PREPARE educore_add_file_url;
