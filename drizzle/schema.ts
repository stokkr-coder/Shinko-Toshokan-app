import { bigint, index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const libraryBooks = mysqlTable("library_books", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  uid: varchar("uid", { length: 96 }).notNull(),
  raw: text("raw").notNull(), title: text("title").notNull(), author: varchar("author", { length: 360 }).notNull(),
  media: varchar("media", { length: 8 }).notNull(), genre: varchar("genre", { length: 8 }).notNull(), slug: varchar("slug", { length: 12 }).notNull(), volume: varchar("volume", { length: 12 }).notNull(),
  collection: varchar("collection", { length: 360 }).notNull(), seriesCode: varchar("seriesCode", { length: 32 }).notNull(), seriesNumber: varchar("seriesNumber", { length: 160 }).notNull(), extension: varchar("extension", { length: 16 }).notNull(),
  shinkoId: varchar("shinkoId", { length: 64 }).notNull(), filename: text("filename").notNull(), classification: varchar("classification", { length: 420 }).notNull(),
  confidence: mysqlEnum("confidence", ["Alta", "Média", "Revisar"]).notNull(), warningsJson: text("warningsJson").notNull(), duplicate: int("duplicate").notNull().default(0), syncRevision: int("syncRevision").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUidUnique: uniqueIndex("library_books_user_uid_unique").on(table.userId, table.uid), userUpdatedIdx: index("library_books_user_updated_idx").on(table.userId, table.updatedAt) }));

export const collectionRules = mysqlTable("collection_rules", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(), matcher: varchar("matcher", { length: 400 }).notNull(), collection: varchar("collection", { length: 180 }).notNull(), seriesCode: varchar("seriesCode", { length: 32 }).notNull(), media: varchar("media", { length: 8 }).notNull(), genre: varchar("genre", { length: 8 }).notNull(), defaultAuthor: varchar("defaultAuthor", { length: 360 }).notNull(), active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUidUnique: uniqueIndex("collection_rules_user_uid_unique").on(table.userId, table.uid) }));

export const libraryAssets = mysqlTable("library_assets", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), bookUid: varchar("bookUid", { length: 96 }).notNull(), uid: varchar("uid", { length: 96 }).notNull(),
  kind: mysqlEnum("kind", ["physical", "digital-link", "digital-file"]).notNull(), label: varchar("label", { length: 240 }).notNull(), location: varchar("location", { length: 480 }).notNull(), sourceUrl: text("sourceUrl").notNull(), storageKey: varchar("storageKey", { length: 720 }).notNull(), storageUrl: text("storageUrl").notNull(), mimeType: varchar("mimeType", { length: 180 }).notNull(), byteSize: int("byteSize").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userBookIdx: index("library_assets_user_book_idx").on(table.userId, table.bookUid), userUidUnique: uniqueIndex("library_assets_user_uid_unique").on(table.userId, table.uid) }));

export const bookMetadata = mysqlTable("book_metadata", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), bookUid: varchar("bookUid", { length: 96 }).notNull(),
  isbn: varchar("isbn", { length: 32 }).notNull(), subtitle: text("subtitle").notNull(), publisher: varchar("publisher", { length: 360 }).notNull(), publishedDate: varchar("publishedDate", { length: 32 }).notNull(), pageCount: int("pageCount").notNull().default(0), summary: text("summary").notNull(), coverUrl: text("coverUrl").notNull(), coverStorageKey: varchar("coverStorageKey", { length: 720 }).notNull(), source: varchar("source", { length: 80 }).notNull(), sourceUrl: text("sourceUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userBookUnique: uniqueIndex("book_metadata_user_book_unique").on(table.userId, table.bookUid), userIsbnIdx: index("book_metadata_user_isbn_idx").on(table.userId, table.isbn) }));

export const readingEvents = mysqlTable("reading_events", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), bookUid: varchar("bookUid", { length: 96 }).notNull(), uid: varchar("uid", { length: 96 }).notNull(),
  type: mysqlEnum("type", ["started", "progress", "finished", "abandoned", "note"]).notNull(), page: int("page").notNull().default(0), progress: int("progress").notNull().default(0), note: text("note").notNull(), occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userBookDateIdx: index("reading_events_user_book_date_idx").on(table.userId, table.bookUid, table.occurredAt), userUidUnique: uniqueIndex("reading_events_user_uid_unique").on(table.userId, table.uid) }));

export const readingGoals = mysqlTable("reading_goals", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(),
  period: mysqlEnum("period", ["monthly", "yearly"]).notNull(), periodKey: varchar("periodKey", { length: 16 }).notNull(), targetBooks: int("targetBooks").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUidUnique: uniqueIndex("reading_goals_user_uid_unique").on(table.userId, table.uid), userPeriodUnique: uniqueIndex("reading_goals_user_period_unique").on(table.userId, table.period, table.periodKey) }));

export const wantToReadItems = mysqlTable("want_to_read_items", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(), bookUid: varchar("bookUid", { length: 96 }).notNull(),
  priority: mysqlEnum("priority", ["Alta", "Média", "Baixa"]).notNull().default("Média"), note: text("note").notNull(), position: int("position").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUidUnique: uniqueIndex("want_to_read_user_uid_unique").on(table.userId, table.uid), userBookUnique: uniqueIndex("want_to_read_user_book_unique").on(table.userId, table.bookUid), userPositionIdx: index("want_to_read_user_position_idx").on(table.userId, table.position) }));

export const classificationMonitorSettings = mysqlTable("classification_monitor_settings", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(),
  alertThresholdCount: int("alertThresholdCount").notNull().default(10), alertThresholdPercent: int("alertThresholdPercent").notNull().default(5), reportFrequency: mysqlEnum("reportFrequency", ["weekly", "monthly"]).notNull().default("weekly"), reportEnabled: int("reportEnabled").notNull().default(1), scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }), lastReportAt: bigint("lastReportAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUnique: uniqueIndex("classification_monitor_user_unique").on(table.userId), userUidUnique: uniqueIndex("classification_monitor_user_uid_unique").on(table.userId, table.uid), scheduleIdx: index("classification_monitor_schedule_idx").on(table.scheduleCronTaskUid) }));

export const classificationReports = mysqlTable("classification_reports", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(), source: mysqlEnum("source", ["import", "manual", "scheduled"]).notNull(),
  periodStart: bigint("periodStart", { mode: "number" }).notNull(), periodEnd: bigint("periodEnd", { mode: "number" }).notNull(), totalBooks: int("totalBooks").notNull().default(0), generalCount: int("generalCount").notNull().default(0), reviewCount: int("reviewCount").notNull().default(0), generalPercentBasisPoints: int("generalPercentBasisPoints").notNull().default(0), exceeded: int("exceeded").notNull().default(0), summaryJson: mediumtext("summaryJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userUidUnique: uniqueIndex("classification_reports_user_uid_unique").on(table.userId, table.uid), userPeriodUnique: uniqueIndex("classification_reports_user_period_unique").on(table.userId, table.source, table.periodStart), userCreatedIdx: index("classification_reports_user_created_idx").on(table.userId, table.createdAt), userSourceIdx: index("classification_reports_user_source_idx").on(table.userId, table.source) }));

export const githubBackupSettings = mysqlTable("github_backup_settings", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(), repository: varchar("repository", { length: 240 }).notNull().default("stokkr-coder/Shinko-Toshokan"), enabled: int("enabled").notNull().default(1), scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }), lastBackupAt: bigint("lastBackupAt", { mode: "number" }), lastBackupPath: varchar("lastBackupPath", { length: 720 }).notNull().default(""), lastCommitSha: varchar("lastCommitSha", { length: 96 }).notNull().default(""), lastError: varchar("lastError", { length: 2000 }).notNull().default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userUnique: uniqueIndex("github_backup_user_unique").on(table.userId), userUidUnique: uniqueIndex("github_backup_user_uid_unique").on(table.userId, table.uid), scheduleIdx: index("github_backup_schedule_idx").on(table.scheduleCronTaskUid) }));

export const libraryBackups = mysqlTable("library_backups", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }), uid: varchar("uid", { length: 96 }).notNull(), label: varchar("label", { length: 240 }).notNull(), snapshotJson: mediumtext("snapshotJson").notNull(), bookCount: int("bookCount").notNull().default(0), ruleCount: int("ruleCount").notNull().default(0), assetCount: int("assetCount").notNull().default(0), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userCreatedIdx: index("library_backups_user_created_idx").on(table.userId, table.createdAt), userUidUnique: uniqueIndex("library_backups_user_uid_unique").on(table.userId, table.uid) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LibraryBook = typeof libraryBooks.$inferSelect;
export type CollectionRule = typeof collectionRules.$inferSelect;
export type LibraryAsset = typeof libraryAssets.$inferSelect;
export type BookMetadata = typeof bookMetadata.$inferSelect;
export type ReadingEvent = typeof readingEvents.$inferSelect;
export type ReadingGoal = typeof readingGoals.$inferSelect;
export type WantToReadItem = typeof wantToReadItems.$inferSelect;
export type ClassificationMonitorSetting = typeof classificationMonitorSettings.$inferSelect;
export type ClassificationReport = typeof classificationReports.$inferSelect;
export type GitHubBackupSetting = typeof githubBackupSettings.$inferSelect;
export type LibraryBackup = typeof libraryBackups.$inferSelect;
