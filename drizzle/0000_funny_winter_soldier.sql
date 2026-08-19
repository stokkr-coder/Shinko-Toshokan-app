CREATE TABLE `collection_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`name` varchar(180) NOT NULL,
	`matcher` varchar(400) NOT NULL,
	`collection` varchar(180) NOT NULL,
	`seriesCode` varchar(32) NOT NULL,
	`media` varchar(8) NOT NULL,
	`genre` varchar(8) NOT NULL,
	`defaultAuthor` varchar(360) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_rules_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
CREATE TABLE `library_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookUid` varchar(96) NOT NULL,
	`uid` varchar(96) NOT NULL,
	`kind` enum('physical','digital-link','digital-file') NOT NULL,
	`label` varchar(240) NOT NULL,
	`location` varchar(480) NOT NULL,
	`sourceUrl` text NOT NULL,
	`storageKey` varchar(720) NOT NULL,
	`storageUrl` text NOT NULL,
	`mimeType` varchar(180) NOT NULL,
	`byteSize` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `library_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `library_assets_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
CREATE TABLE `library_backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`label` varchar(240) NOT NULL,
	`snapshotJson` mediumtext NOT NULL,
	`bookCount` int NOT NULL DEFAULT 0,
	`ruleCount` int NOT NULL DEFAULT 0,
	`assetCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `library_backups_id` PRIMARY KEY(`id`),
	CONSTRAINT `library_backups_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
CREATE TABLE `library_books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`raw` text NOT NULL,
	`title` text NOT NULL,
	`author` varchar(360) NOT NULL,
	`media` varchar(8) NOT NULL,
	`genre` varchar(8) NOT NULL,
	`slug` varchar(12) NOT NULL,
	`volume` varchar(12) NOT NULL,
	`collection` varchar(360) NOT NULL,
	`seriesCode` varchar(32) NOT NULL,
	`seriesNumber` varchar(160) NOT NULL,
	`extension` varchar(16) NOT NULL,
	`shinkoId` varchar(64) NOT NULL,
	`filename` text NOT NULL,
	`classification` varchar(420) NOT NULL,
	`confidence` enum('Alta','Média','Revisar') NOT NULL,
	`warningsJson` text NOT NULL,
	`duplicate` int NOT NULL DEFAULT 0,
	`syncRevision` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `library_books_id` PRIMARY KEY(`id`),
	CONSTRAINT `library_books_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `collection_rules` ADD CONSTRAINT `collection_rules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `library_assets` ADD CONSTRAINT `library_assets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `library_backups` ADD CONSTRAINT `library_backups_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `library_books` ADD CONSTRAINT `library_books_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `library_assets_user_book_idx` ON `library_assets` (`userId`,`bookUid`);--> statement-breakpoint
CREATE INDEX `library_backups_user_created_idx` ON `library_backups` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `library_books_user_updated_idx` ON `library_books` (`userId`,`updatedAt`);