CREATE TABLE `academic_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`academicPeriodId` int NOT NULL,
	`assessmentId` int,
	`text` text NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessment_grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`assessmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`studentEnrollmentId` int NOT NULL,
	`courseId` int NOT NULL,
	`subjectId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`academicPeriodId` int NOT NULL,
	`value` double,
	`comment` text,
	`status` varchar(20) NOT NULL DEFAULT 'RECORDED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessment_grades_id` PRIMARY KEY(`id`),
	CONSTRAINT `assessment_grades_assessment_student_unique` UNIQUE(`assessmentId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`academicPeriodId` int NOT NULL,
	`courseId` int NOT NULL,
	`subjectId` int NOT NULL,
	`teacherId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text,
	`assessmentType` varchar(30) NOT NULL DEFAULT 'ACTIVIDAD',
	`date` timestamp NOT NULL,
	`maxValue` double NOT NULL DEFAULT 5,
	`weight` double NOT NULL DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grading_scales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`minValue` double NOT NULL DEFAULT 0,
	`maxValue` double NOT NULL DEFAULT 5,
	`decimalPlaces` int NOT NULL DEFAULT 1,
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grading_scales_id` PRIMARY KEY(`id`),
	CONSTRAINT `grading_scales_school_name_unique` UNIQUE(`schoolId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `report_card_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`academicPeriodId` int NOT NULL,
	`courseId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'READY',
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	`dataJson` text NOT NULL,
	CONSTRAINT `report_card_runs_id` PRIMARY KEY(`id`)
);
