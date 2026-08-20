import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { bookMetadata, classificationMonitorSettings, classificationReports, collectionRules, githubBackupSettings, InsertUser, libraryAssets, libraryBackups, libraryBooks, readingEvents, readingGoals, users, wantToReadItems } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { deserializeLibrarySnapshot, serializeLibrarySnapshot } from "./backupCodec";
import { replaceLibrarySnapshot } from "./restoreLibrary";
import { calculateClassificationMetrics, reportWindowStart, type ClassificationMonitorBook } from "../shared/classificationMonitoring";
import type { GitHubCatalogSnapshot } from "./githubBackup";

export type BookPayload = { uid: string; raw: string; title: string; author: string; media: string; genre: string; slug: string; volume: string; collection: string; seriesCode: string; seriesNumber: string; extension: string; shinkoId: string; filename: string; classification: string; confidence: "Alta" | "Média" | "Revisar"; warnings: string[]; duplicate: boolean };
export type RulePayload = { uid: string; name: string; matcher: string; collection: string; seriesCode: string; media: string; genre: string; defaultAuthor: string; active: boolean };
export type AssetPayload = { uid: string; bookUid: string; kind: "physical" | "digital-link" | "digital-file"; label: string; location: string; sourceUrl: string; storageKey: string; storageUrl: string; mimeType: string; byteSize: number };
export type MetadataPayload = { bookUid: string; isbn: string; subtitle: string; publisher: string; publishedDate: string; pageCount: number; summary: string; coverUrl: string; coverStorageKey: string; source: string; sourceUrl: string };
export type ReadingEventPayload = { uid: string; bookUid: string; type: "started" | "progress" | "finished" | "abandoned" | "note"; page: number; progress: number; note: string; occurredAt: number };
export type ReadingGoalPayload = { uid: string; period: "monthly" | "yearly"; periodKey: string; targetBooks: number };
export type WantToReadPayload = { uid: string; bookUid: string; priority: "Alta" | "Média" | "Baixa"; note: string; position: number };
export type ClassificationMonitorSettingsPayload = { uid: string; alertThresholdCount: number; alertThresholdPercent: number; reportFrequency: "weekly" | "monthly"; reportEnabled: boolean; scheduleCronTaskUid: string; lastReportAt: number | null };
export type ClassificationReportPayload = { uid: string; source: "import" | "manual" | "scheduled"; periodStart: number; periodEnd: number; totalBooks: number; generalCount: number; reviewCount: number; generalPercentBasisPoints: number; exceeded: boolean; summary: ReturnType<typeof calculateClassificationMetrics>["summary"] };
export type GitHubBackupSettingsPayload = { uid: string; repository: string; enabled: boolean; scheduleCronTaskUid: string; lastBackupAt: number | null; lastBackupPath: string; lastCommitSha: string; lastError: string };

const isManusStorageReference = (value: string) => /(?:^|\/)manus-storage(?:\/|$)/.test(value);

export function sanitizeExternalSnapshot(snapshot: LibrarySnapshot): LibrarySnapshot {
  if (ENV.authProvider !== "google") return snapshot;
  return {
    ...snapshot,
    assets: snapshot.assets.map((asset) => isManusStorageReference(asset.storageUrl) ? { ...asset, storageKey: "", storageUrl: "" } : asset),
    metadata: snapshot.metadata.map((item) => isManusStorageReference(item.coverUrl) ? { ...item, coverStorageKey: "", coverUrl: "" } : item),
  };
}

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; } } return _db; }
async function requireDb() { const db = await getDb(); if (!db) throw new Error("O armazenamento do acervo não está disponível no momento."); return db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn || new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach((field) => { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } });
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }
export async function getExternalLibraryOwner() { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.role, "admin")).orderBy(asc(users.id)).limit(1))[0]; }

const bookValues = (userId: number, book: BookPayload) => ({ userId, uid: book.uid, raw: book.raw, title: book.title, author: book.author, media: book.media, genre: book.genre, slug: book.slug, volume: book.volume, collection: book.collection, seriesCode: book.seriesCode, seriesNumber: book.seriesNumber, extension: book.extension, shinkoId: book.shinkoId, filename: book.filename, classification: book.classification, confidence: book.confidence, warningsJson: JSON.stringify(book.warnings), duplicate: book.duplicate ? 1 : 0 });
export async function listBooks(userId: number) { const db = await requireDb(); return db.select().from(libraryBooks).where(eq(libraryBooks.userId, userId)).orderBy(desc(libraryBooks.updatedAt)); }
export async function upsertBook(userId: number, book: BookPayload) { const db = await requireDb(); const values = bookValues(userId, book); await db.insert(libraryBooks).values(values).onDuplicateKeyUpdate({ set: { ...values, syncRevision: 1, updatedAt: new Date() } }); }
export async function upsertBooks(userId: number, books: BookPayload[]) { for (const book of books) await upsertBook(userId, book); return listBooks(userId); }
export async function deleteBook(userId: number, uid: string) { const db = await requireDb(); await db.delete(wantToReadItems).where(and(eq(wantToReadItems.userId, userId), eq(wantToReadItems.bookUid, uid))); await db.delete(readingEvents).where(and(eq(readingEvents.userId, userId), eq(readingEvents.bookUid, uid))); await db.delete(bookMetadata).where(and(eq(bookMetadata.userId, userId), eq(bookMetadata.bookUid, uid))); await db.delete(libraryAssets).where(and(eq(libraryAssets.userId, userId), eq(libraryAssets.bookUid, uid))); await db.delete(libraryBooks).where(and(eq(libraryBooks.userId, userId), eq(libraryBooks.uid, uid))); }

const ruleValues = (userId: number, rule: RulePayload) => ({ userId, uid: rule.uid, name: rule.name, matcher: rule.matcher, collection: rule.collection, seriesCode: rule.seriesCode, media: rule.media, genre: rule.genre, defaultAuthor: rule.defaultAuthor, active: rule.active ? 1 : 0 });
export async function listRules(userId: number) { const db = await requireDb(); return db.select().from(collectionRules).where(eq(collectionRules.userId, userId)).orderBy(desc(collectionRules.updatedAt)); }
export async function upsertRule(userId: number, rule: RulePayload) { const db = await requireDb(); const values = ruleValues(userId, rule); await db.insert(collectionRules).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } }); }
export async function deleteRule(userId: number, uid: string) { const db = await requireDb(); await db.delete(collectionRules).where(and(eq(collectionRules.userId, userId), eq(collectionRules.uid, uid))); }

export async function listAssets(userId: number, bookUid?: string) { const db = await requireDb(); const base = eq(libraryAssets.userId, userId); return bookUid ? db.select().from(libraryAssets).where(and(base, eq(libraryAssets.bookUid, bookUid))).orderBy(desc(libraryAssets.createdAt)) : db.select().from(libraryAssets).where(base).orderBy(desc(libraryAssets.createdAt)); }
export async function upsertAsset(userId: number, asset: AssetPayload) { const db = await requireDb(); const values = { userId, ...asset }; await db.insert(libraryAssets).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } }); }
export async function deleteAsset(userId: number, uid: string) { const db = await requireDb(); await db.delete(libraryAssets).where(and(eq(libraryAssets.userId, userId), eq(libraryAssets.uid, uid))); }

const metadataValues = (userId: number, metadata: MetadataPayload) => ({ userId, ...metadata });
export async function listMetadata(userId: number) { const db = await requireDb(); return db.select().from(bookMetadata).where(eq(bookMetadata.userId, userId)).orderBy(desc(bookMetadata.updatedAt)); }
export async function upsertMetadata(userId: number, metadata: MetadataPayload) { const db = await requireDb(); const values = metadataValues(userId, metadata); await db.insert(bookMetadata).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } }); }

const readingValues = (userId: number, event: ReadingEventPayload) => ({ userId, ...event });
export async function listReadingEvents(userId: number, bookUid?: string) { const db = await requireDb(); const base = eq(readingEvents.userId, userId); return bookUid ? db.select().from(readingEvents).where(and(base, eq(readingEvents.bookUid, bookUid))).orderBy(desc(readingEvents.occurredAt)) : db.select().from(readingEvents).where(base).orderBy(desc(readingEvents.occurredAt)); }
export async function createReadingEvent(userId: number, event: ReadingEventPayload) { const db = await requireDb(); await db.insert(readingEvents).values(readingValues(userId, event)); return listReadingEvents(userId, event.bookUid); }

export async function listReadingGoals(userId: number) { const db = await requireDb(); return db.select().from(readingGoals).where(eq(readingGoals.userId, userId)).orderBy(desc(readingGoals.updatedAt)); }
export async function upsertReadingGoal(userId: number, goal: ReadingGoalPayload) { const db = await requireDb(); const values = { userId, ...goal }; await db.insert(readingGoals).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } }); }

export async function listWantToRead(userId: number) { const db = await requireDb(); return db.select().from(wantToReadItems).where(eq(wantToReadItems.userId, userId)).orderBy(asc(wantToReadItems.position), desc(wantToReadItems.updatedAt)); }
export async function upsertWantToRead(userId: number, item: WantToReadPayload) { const db = await requireDb(); const values = { userId, ...item }; await db.insert(wantToReadItems).values(values).onDuplicateKeyUpdate({ set: { priority: item.priority, note: item.note, position: item.position, updatedAt: new Date() } }); }
export async function deleteWantToRead(userId: number, uid: string) { const db = await requireDb(); await db.delete(wantToReadItems).where(and(eq(wantToReadItems.userId, userId), eq(wantToReadItems.uid, uid))); }
export async function reorderWantToRead(userId: number, uids: string[]) { const db = await requireDb(); const items = await listWantToRead(userId); if (uids.length !== items.length || new Set(uids).size !== uids.length || uids.some((uid) => !items.some((item) => item.uid === uid))) throw new Error("A ordenação da lista não corresponde aos itens salvos."); await Promise.all(uids.map((uid, position) => db.update(wantToReadItems).set({ position, updatedAt: new Date() }).where(and(eq(wantToReadItems.userId, userId), eq(wantToReadItems.uid, uid))))); return listWantToRead(userId); }

const defaultClassificationMonitorSettings = (userId: number): ClassificationMonitorSettingsPayload => ({ uid: `monitor-${userId}`, alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly", reportEnabled: true, scheduleCronTaskUid: "", lastReportAt: null });
const monitorBookFromPayload = (book: BookPayload): ClassificationMonitorBook => ({ uid: book.uid, title: book.title, author: book.author, raw: book.raw, media: book.media, genre: book.genre, collection: book.collection, confidence: book.confidence, warnings: book.warnings });
const monitorBookFromRow = (book: typeof libraryBooks.$inferSelect): ClassificationMonitorBook => ({ uid: book.uid, title: book.title, author: book.author, raw: book.raw, media: book.media, genre: book.genre, collection: book.collection, confidence: book.confidence, warnings: JSON.parse(book.warningsJson || "[]") as string[] });
const monitorSettingsFromRow = (row: typeof classificationMonitorSettings.$inferSelect): ClassificationMonitorSettingsPayload => ({ uid: row.uid, alertThresholdCount: row.alertThresholdCount, alertThresholdPercent: row.alertThresholdPercent, reportFrequency: row.reportFrequency, reportEnabled: row.reportEnabled === 1, scheduleCronTaskUid: row.scheduleCronTaskUid || "", lastReportAt: row.lastReportAt ?? null });
const reportFromRow = (row: typeof classificationReports.$inferSelect): ClassificationReportPayload => ({ uid: row.uid, source: row.source, periodStart: row.periodStart, periodEnd: row.periodEnd, totalBooks: row.totalBooks, generalCount: row.generalCount, reviewCount: row.reviewCount, generalPercentBasisPoints: row.generalPercentBasisPoints, exceeded: row.exceeded === 1, summary: JSON.parse(row.summaryJson) as ClassificationReportPayload["summary"] });

export async function getClassificationMonitorSettings(userId: number) {
  const db = await requireDb();
  const row = (await db.select().from(classificationMonitorSettings).where(eq(classificationMonitorSettings.userId, userId)).limit(1))[0];
  return row ? monitorSettingsFromRow(row) : defaultClassificationMonitorSettings(userId);
}

export async function upsertClassificationMonitorSettings(userId: number, settings: ClassificationMonitorSettingsPayload) {
  const db = await requireDb();
  const values = { userId, uid: settings.uid, alertThresholdCount: settings.alertThresholdCount, alertThresholdPercent: settings.alertThresholdPercent, reportFrequency: settings.reportFrequency, reportEnabled: settings.reportEnabled ? 1 : 0, scheduleCronTaskUid: settings.scheduleCronTaskUid || null, lastReportAt: settings.lastReportAt };
  await db.insert(classificationMonitorSettings).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
  return getClassificationMonitorSettings(userId);
}

export async function updateClassificationSchedule(userId: number, scheduleCronTaskUid: string) {
  const settings = await getClassificationMonitorSettings(userId);
  return upsertClassificationMonitorSettings(userId, { ...settings, scheduleCronTaskUid });
}

export async function getClassificationMonitorSettingsBySchedule(scheduleCronTaskUid: string) {
  const db = await requireDb();
  const row = (await db.select().from(classificationMonitorSettings).where(eq(classificationMonitorSettings.scheduleCronTaskUid, scheduleCronTaskUid)).limit(1))[0];
  return row ? { userId: row.userId, settings: monitorSettingsFromRow(row) } : null;
}

export async function listClassificationReports(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(classificationReports).where(eq(classificationReports.userId, userId)).orderBy(desc(classificationReports.createdAt));
  return rows.map(reportFromRow);
}

export async function createClassificationReport(userId: number, source: ClassificationReportPayload["source"], options: { books?: BookPayload[]; periodStart?: number; periodEnd?: number } = {}) {
  const db = await requireDb();
  const settings = await getClassificationMonitorSettings(userId);
  const books = options.books ? options.books.map(monitorBookFromPayload) : (await listBooks(userId)).map(monitorBookFromRow);
  const metrics = calculateClassificationMetrics(books, { count: settings.alertThresholdCount, percent: settings.alertThresholdPercent });
  const periodEnd = options.periodEnd ?? Date.now();
  const periodStart = options.periodStart ?? periodEnd;
  const payload: ClassificationReportPayload = { uid: crypto.randomUUID(), source, periodStart, periodEnd, totalBooks: metrics.totalBooks, generalCount: metrics.generalCount, reviewCount: metrics.reviewCount, generalPercentBasisPoints: metrics.generalPercentBasisPoints, exceeded: metrics.exceeded, summary: metrics.summary };
  await db.insert(classificationReports).values({ userId, uid: payload.uid, source: payload.source, periodStart: payload.periodStart, periodEnd: payload.periodEnd, totalBooks: payload.totalBooks, generalCount: payload.generalCount, reviewCount: payload.reviewCount, generalPercentBasisPoints: payload.generalPercentBasisPoints, exceeded: payload.exceeded ? 1 : 0, summaryJson: JSON.stringify(payload.summary) });
  return payload;
}

export async function getClassificationDashboard(userId: number) {
  const [settings, books, reports] = await Promise.all([getClassificationMonitorSettings(userId), listBooks(userId), listClassificationReports(userId)]);
  const metrics = calculateClassificationMetrics(books.map(monitorBookFromRow), { count: settings.alertThresholdCount, percent: settings.alertThresholdPercent });
  return { settings, ...metrics, latestReport: reports[0] || null };
}

export async function createScheduledClassificationReport(userId: number) {
  const db = await requireDb();
  const settings = await getClassificationMonitorSettings(userId);
  if (!settings.reportEnabled) return { skipped: "disabled" as const, report: null };
  const periodStart = reportWindowStart(settings.reportFrequency);
  const existing = (await db.select().from(classificationReports).where(and(eq(classificationReports.userId, userId), eq(classificationReports.source, "scheduled"), eq(classificationReports.periodStart, periodStart))).limit(1))[0];
  if (existing) return { skipped: "already-generated" as const, report: reportFromRow(existing) };
  const report = await createClassificationReport(userId, "scheduled", { periodStart });
  await db.update(classificationMonitorSettings).set({ lastReportAt: report.periodEnd, updatedAt: new Date() }).where(eq(classificationMonitorSettings.userId, userId));
  return { skipped: null, report };
}

const defaultGitHubBackupSettings = (userId: number): GitHubBackupSettingsPayload => ({ uid: `github-backup-${userId}`, repository: "stokkr-coder/Shinko-Toshokan", enabled: true, scheduleCronTaskUid: "", lastBackupAt: null, lastBackupPath: "", lastCommitSha: "", lastError: "" });
const githubBackupSettingsFromRow = (row: typeof githubBackupSettings.$inferSelect): GitHubBackupSettingsPayload => ({ uid: row.uid, repository: row.repository, enabled: row.enabled === 1, scheduleCronTaskUid: row.scheduleCronTaskUid || "", lastBackupAt: row.lastBackupAt ?? null, lastBackupPath: row.lastBackupPath, lastCommitSha: row.lastCommitSha, lastError: row.lastError });

export async function getGitHubBackupSettings(userId: number) {
  const db = await requireDb();
  const row = (await db.select().from(githubBackupSettings).where(eq(githubBackupSettings.userId, userId)).limit(1))[0];
  return row ? githubBackupSettingsFromRow(row) : defaultGitHubBackupSettings(userId);
}

export async function upsertGitHubBackupSettings(userId: number, settings: GitHubBackupSettingsPayload) {
  const db = await requireDb();
  const values = { userId, uid: settings.uid, repository: settings.repository, enabled: settings.enabled ? 1 : 0, scheduleCronTaskUid: settings.scheduleCronTaskUid || null, lastBackupAt: settings.lastBackupAt, lastBackupPath: settings.lastBackupPath, lastCommitSha: settings.lastCommitSha, lastError: settings.lastError };
  await db.insert(githubBackupSettings).values(values).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
  return getGitHubBackupSettings(userId);
}

export async function updateGitHubBackupSchedule(userId: number, scheduleCronTaskUid: string) {
  const current = await getGitHubBackupSettings(userId);
  return upsertGitHubBackupSettings(userId, { ...current, scheduleCronTaskUid });
}

export async function getGitHubBackupSettingsBySchedule(scheduleCronTaskUid: string) {
  const db = await requireDb();
  const row = (await db.select().from(githubBackupSettings).where(eq(githubBackupSettings.scheduleCronTaskUid, scheduleCronTaskUid)).limit(1))[0];
  return row ? { userId: row.userId, settings: githubBackupSettingsFromRow(row) } : null;
}

export async function recordGitHubBackupResult(userId: number, result: { path: string; commitSha: string; createdAt: string } | null, error = "") {
  const current = await getGitHubBackupSettings(userId);
  return upsertGitHubBackupSettings(userId, { ...current, lastBackupAt: result ? new Date(result.createdAt).getTime() : current.lastBackupAt, lastBackupPath: result?.path || current.lastBackupPath, lastCommitSha: result?.commitSha || current.lastCommitSha, lastError: error.slice(0, 2000) });
}

export function mergeGitHubCatalogSnapshot(current: LibrarySnapshot, catalog: GitHubCatalogSnapshot): LibrarySnapshot {
  const restoredBookUids = new Set(catalog.books.map((book) => book.uid));
  return { ...current, books: catalog.books, rules: catalog.rules, assets: current.assets.filter((asset) => restoredBookUids.has(asset.bookUid)), metadata: current.metadata.filter((metadata) => restoredBookUids.has(metadata.bookUid)), readingEvents: current.readingEvents.filter((event) => restoredBookUids.has(event.bookUid)), wantToRead: current.wantToRead.filter((item) => restoredBookUids.has(item.bookUid)) };
}

export async function restoreGitHubCatalog(userId: number, catalog: GitHubCatalogSnapshot) {
  const db = await requireDb();
  const snapshot = mergeGitHubCatalogSnapshot(await getLibrarySnapshot(userId), catalog);
  await replaceLibrarySnapshot(db, userId, snapshot);
  return { bookCount: snapshot.books.length, ruleCount: snapshot.rules.length };
}

export type LibrarySnapshot = { books: BookPayload[]; rules: RulePayload[]; assets: AssetPayload[]; metadata: MetadataPayload[]; readingEvents: ReadingEventPayload[]; goals: ReadingGoalPayload[]; wantToRead: WantToReadPayload[]; classificationMonitorSettings: ClassificationMonitorSettingsPayload; classificationReports: ClassificationReportPayload[] };
export async function getLibrarySnapshot(userId: number): Promise<LibrarySnapshot> {
  const [bookRows, ruleRows, assetRows, metadataRows, eventRows, goalRows, wantToReadRows, monitorSettings, reports] = await Promise.all([listBooks(userId), listRules(userId), listAssets(userId), listMetadata(userId), listReadingEvents(userId), listReadingGoals(userId), listWantToRead(userId), getClassificationMonitorSettings(userId), listClassificationReports(userId)]);
  return {
    books: bookRows.map((row) => ({ uid: row.uid, raw: row.raw, title: row.title, author: row.author, media: row.media, genre: row.genre, slug: row.slug, volume: row.volume, collection: row.collection, seriesCode: row.seriesCode, seriesNumber: row.seriesNumber, extension: row.extension, shinkoId: row.shinkoId, filename: row.filename, classification: row.classification, confidence: row.confidence, warnings: JSON.parse(row.warningsJson || "[]"), duplicate: row.duplicate === 1 })),
    rules: ruleRows.map((row) => ({ uid: row.uid, name: row.name, matcher: row.matcher, collection: row.collection, seriesCode: row.seriesCode, media: row.media, genre: row.genre, defaultAuthor: row.defaultAuthor, active: row.active === 1 })),
    assets: assetRows.map((row) => ({ uid: row.uid, bookUid: row.bookUid, kind: row.kind, label: row.label, location: row.location, sourceUrl: row.sourceUrl, storageKey: row.storageKey, storageUrl: row.storageUrl, mimeType: row.mimeType, byteSize: row.byteSize })),
    metadata: metadataRows.map((row) => ({ bookUid: row.bookUid, isbn: row.isbn, subtitle: row.subtitle, publisher: row.publisher, publishedDate: row.publishedDate, pageCount: row.pageCount, summary: row.summary, coverUrl: row.coverUrl, coverStorageKey: row.coverStorageKey, source: row.source, sourceUrl: row.sourceUrl })),
    readingEvents: eventRows.map((row) => ({ uid: row.uid, bookUid: row.bookUid, type: row.type, page: row.page, progress: row.progress, note: row.note, occurredAt: row.occurredAt })),
    goals: goalRows.map((row) => ({ uid: row.uid, period: row.period, periodKey: row.periodKey, targetBooks: row.targetBooks })),
    wantToRead: wantToReadRows.map((row) => ({ uid: row.uid, bookUid: row.bookUid, priority: row.priority, note: row.note, position: row.position })),
    classificationMonitorSettings: monitorSettings,
    classificationReports: reports,
  };
}

export async function createBackup(userId: number, label: string) { const db = await requireDb(); const snapshot = await getLibrarySnapshot(userId); const uid = crypto.randomUUID(); await db.insert(libraryBackups).values({ userId, uid, label, snapshotJson: serializeLibrarySnapshot(snapshot), bookCount: snapshot.books.length, ruleCount: snapshot.rules.length, assetCount: snapshot.assets.length }); return { uid, ...snapshot, createdAt: new Date() }; }
export async function listBackups(userId: number) { const db = await requireDb(); return db.select({ uid: libraryBackups.uid, label: libraryBackups.label, bookCount: libraryBackups.bookCount, ruleCount: libraryBackups.ruleCount, assetCount: libraryBackups.assetCount, createdAt: libraryBackups.createdAt }).from(libraryBackups).where(eq(libraryBackups.userId, userId)).orderBy(desc(libraryBackups.createdAt)); }
export async function restoreBackup(userId: number, backupUid: string) { const db = await requireDb(); const rows = await db.select().from(libraryBackups).where(and(eq(libraryBackups.userId, userId), eq(libraryBackups.uid, backupUid))).limit(1); if (!rows[0]) throw new Error("Cópia de segurança não encontrada."); const snapshot = deserializeLibrarySnapshot(rows[0].snapshotJson); await replaceLibrarySnapshot(db, userId, snapshot); return snapshot; }
export async function importLibrarySnapshot(userId: number, snapshot: LibrarySnapshot) { const db = await requireDb(); const sanitized = sanitizeExternalSnapshot(snapshot); await replaceLibrarySnapshot(db, userId, sanitized); return { bookCount: sanitized.books.length, ruleCount: sanitized.rules.length, assetCount: sanitized.assets.length }; }
