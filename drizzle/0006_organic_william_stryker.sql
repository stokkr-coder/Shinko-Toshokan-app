CREATE TABLE `github_backup_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`repository` varchar(240) NOT NULL DEFAULT 'stokkr-coder/Shinko-Toshokan',
	`enabled` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`lastBackupAt` bigint,
	`lastBackupPath` varchar(720) NOT NULL DEFAULT '',
	`lastCommitSha` varchar(96) NOT NULL DEFAULT '',
	`lastError` varchar(2000) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `github_backup_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `github_backup_user_unique` UNIQUE(`userId`),
	CONSTRAINT `github_backup_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
ALTER TABLE `github_backup_settings` ADD CONSTRAINT `github_backup_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `github_backup_schedule_idx` ON `github_backup_settings` (`scheduleCronTaskUid`);
