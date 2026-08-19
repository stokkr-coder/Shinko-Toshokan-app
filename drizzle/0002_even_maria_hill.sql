CREATE TABLE `reading_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`period` enum('monthly','yearly') NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`targetBooks` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reading_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `reading_goals_user_uid_unique` UNIQUE(`userId`,`uid`),
	CONSTRAINT `reading_goals_user_period_unique` UNIQUE(`userId`,`period`,`periodKey`)
);
--> statement-breakpoint
ALTER TABLE `reading_goals` ADD CONSTRAINT `reading_goals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;