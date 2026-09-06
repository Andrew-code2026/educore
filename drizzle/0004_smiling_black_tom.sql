CREATE TABLE `guardian_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schoolId` int NOT NULL,
	CONSTRAINT `guardian_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardian_profiles_school_user_unique` UNIQUE(`schoolId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `guardian_student_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardianUserId` int NOT NULL,
	`studentUserId` int NOT NULL,
	`schoolId` int NOT NULL,
	`relationshipType` varchar(30) NOT NULL DEFAULT 'PARENT',
	`isPrimary` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guardian_student_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardian_student_school_unique` UNIQUE(`guardianUserId`,`studentUserId`,`schoolId`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`roleKey` varchar(40) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`expiresAt` timestamp NOT NULL,
	`invitedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(80) NOT NULL,
	`module` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int NOT NULL,
	`permissionId` int NOT NULL,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permissions_role_permission_unique` UNIQUE(`roleId`,`permissionId`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`hierarchyLevel` int NOT NULL DEFAULT 0,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `school_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`roleKey` varchar(40) NOT NULL DEFAULT 'STUDENT',
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_memberships_school_user_unique` UNIQUE(`schoolId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schoolId` int NOT NULL,
	`studentCode` varchar(60),
	`gradeLevel` varchar(20),
	`course` varchar(60),
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_profiles_school_user_unique` UNIQUE(`schoolId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `teacher_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`schoolId` int NOT NULL,
	`employeeCode` varchar(60),
	`specialties` text,
	`subjects` text,
	CONSTRAINT `teacher_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_profiles_school_user_unique` UNIQUE(`schoolId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `actorUserId` int;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `targetUserId` int;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `targetType` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `firstName` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `lastName` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `status` varchar(20) DEFAULT 'ACTIVE' NOT NULL;