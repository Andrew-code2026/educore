CREATE TABLE `academic_periods` (
  `id` int AUTO_INCREMENT NOT NULL,
  `schoolId` int NOT NULL,
  `name` varchar(80) NOT NULL,
  `startDate` timestamp NOT NULL,
  `endDate` timestamp NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Activo',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `academic_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `schools` ADD `shortName` varchar(80) DEFAULT 'Gimnasio Moderno' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `department` varchar(100) DEFAULT 'Valle del Cauca' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `country` varchar(80) DEFAULT 'Colombia' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `description` text;
--> statement-breakpoint
ALTER TABLE `schools` ADD `website` varchar(180) DEFAULT 'https://educore.co' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `email` varchar(180) DEFAULT 'contacto@educore.co' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `phone` varchar(40) DEFAULT '+57 602 555 0101' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `address` varchar(180) DEFAULT 'Cali, Valle del Cauca' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `status` varchar(30) DEFAULT 'Activo' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `accentColor` varchar(20) DEFAULT '#8ec6fa' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `backgroundColor` varchar(20) DEFAULT '#f7f9fc' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `surfaceColor` varchar(20) DEFAULT '#ffffff' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `textColor` varchar(20) DEFAULT '#182131' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `mutedTextColor` varchar(20) DEFAULT '#7a8798' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `fontFamily` varchar(120) DEFAULT 'system' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `themeMode` varchar(20) DEFAULT 'light' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `borderRadius` varchar(20) DEFAULT '12px' NOT NULL;
--> statement-breakpoint
ALTER TABLE `schools` ADD `faviconUrl` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `schoolId` int;
