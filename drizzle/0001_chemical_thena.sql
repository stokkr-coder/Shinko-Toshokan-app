CREATE TABLE `book_metadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookUid` varchar(96) NOT NULL,
	`isbn` varchar(32) NOT NULL,
	`subtitle` text NOT NULL,
	`publisher` varchar(360) NOT NULL,
	`publishedDate` varchar(32) NOT NULL,
	`pageCount` int NOT NULL DEFAULT 0,
	`summary` text NOT NULL,
	`coverUrl` text NOT NULL,
	`coverStorageKey` varchar(720) NOT NULL,
	`source` varchar(80) NOT NULL,
	`sourceUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `book_metadata_id` PRIMARY KEY(`id`),
	CONSTRAINT `book_metadata_user_book_unique` UNIQUE(`userId`,`bookUid`)
);
--> statement-breakpoint
CREATE TABLE `reading_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookUid` varchar(96) NOT NULL,
	`uid` varchar(96) NOT NULL,
	`type` enum('started','progress','finished','abandoned','note') NOT NULL,
	`page` int NOT NULL DEFAULT 0,
	`progress` int NOT NULL DEFAULT 0,
	`note` text NOT NULL,
	`occurredAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reading_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `reading_events_user_uid_unique` UNIQUE(`userId`,`uid`)
);
--> statement-breakpoint
ALTER TABLE `book_metadata` ADD CONSTRAINT `book_metadata_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reading_events` ADD CONSTRAINT `reading_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `book_metadata_user_isbn_idx` ON `book_metadata` (`userId`,`isbn`);--> statement-breakpoint
CREATE INDEX `reading_events_user_book_date_idx` ON `reading_events` (`userId`,`bookUid`,`occurredAt`);