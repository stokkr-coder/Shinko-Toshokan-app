CREATE TABLE `classification_monitor_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`alertThresholdCount` int NOT NULL DEFAULT 10,
	`alertThresholdPercent` int NOT NULL DEFAULT 5,
	`reportFrequency` enum('weekly','monthly') NOT NULL DEFAULT 'weekly',
	`reportEnabled` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`lastReportAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classification_monitor_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `classification_monitor_user_unique` UNIQUE(`userId`),
	CONSTRAINT `classification_monitor_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
CREATE TABLE `classification_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`source` enum('import','manual','scheduled') NOT NULL,
	`periodStart` bigint NOT NULL,
	`periodEnd` bigint NOT NULL,
	`totalBooks` int NOT NULL DEFAULT 0,
	`generalCount` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`generalPercentBasisPoints` int NOT NULL DEFAULT 0,
	`exceeded` int NOT NULL DEFAULT 0,
	`summaryJson` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classification_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `classification_reports_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
ALTER TABLE `classification_monitor_settings` ADD CONSTRAINT `classification_monitor_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classification_reports` ADD CONSTRAINT `classification_reports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `classification_monitor_schedule_idx` ON `classification_monitor_settings` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `classification_reports_user_created_idx` ON `classification_reports` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `classification_reports_user_source_idx` ON `classification_reports` (`userId`,`source`);