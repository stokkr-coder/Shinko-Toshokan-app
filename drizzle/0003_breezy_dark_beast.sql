CREATE TABLE `want_to_read_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`uid` varchar(96) NOT NULL,
	`bookUid` varchar(96) NOT NULL,
	`priority` enum('Alta','Média','Baixa') NOT NULL DEFAULT 'Média',
	`note` text NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `want_to_read_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `want_to_read_user_uid_unique` UNIQUE(`userId`,`uid`),
	CONSTRAINT `want_to_read_user_book_unique` UNIQUE(`userId`,`bookUid`)
);
--> statement-breakpoint
ALTER TABLE `want_to_read_items` ADD CONSTRAINT `want_to_read_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `want_to_read_user_position_idx` ON `want_to_read_items` (`userId`,`position`);