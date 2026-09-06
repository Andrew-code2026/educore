CREATE TABLE `academic_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`year` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_years_school_year_unique` UNIQUE(`schoolId`,`year`)
);
--> statement-breakpoint
CREATE TABLE `course_subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`courseId` int NOT NULL,
	`subjectId` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `course_subjects_school_course_subject_unique` UNIQUE(`schoolId`,`courseId`,`subjectId`)
);
--> statement-breakpoint
CREATE TABLE `enrollment_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`enrollmentId` int NOT NULL,
	`studentUserId` int NOT NULL,
	`fromCourseId` int,
	`toCourseId` int NOT NULL,
	`changedByUserId` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `enrollment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grade_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`shortName` varchar(20) NOT NULL,
	`levelOrder` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	CONSTRAINT `grade_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `grade_levels_school_short_unique` UNIQUE(`schoolId`,`shortName`)
);
--> statement-breakpoint
CREATE TABLE `student_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentUserId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`courseId` int NOT NULL,
	`enrollmentStatus` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`enrollmentDate` timestamp NOT NULL DEFAULT (now()),
	`withdrawalDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_enrollments_school_student_year_course_unique` UNIQUE(`schoolId`,`studentUserId`,`academicYearId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `teacher_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`teacherUserId` int NOT NULL,
	`courseId` int NOT NULL,
	`subjectId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`isPrimary` int NOT NULL DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_assignments_school_unique` UNIQUE(`schoolId`,`teacherUserId`,`courseId`,`subjectId`,`academicYearId`)
);
--> statement-breakpoint
ALTER TABLE `academic_periods` ADD `academicYearId` int;--> statement-breakpoint
ALTER TABLE `academic_periods` ADD `orderIndex` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `academicYearId` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `gradeLevelId` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `courses` ADD `capacity` int;--> statement-breakpoint
ALTER TABLE `courses` ADD `status` varchar(20) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `subjects` ADD `shortName` varchar(40);--> statement-breakpoint
ALTER TABLE `subjects` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `subjects` ADD `description` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `status` varchar(20) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;