import { eq } from "drizzle-orm";
import { bookMetadata, classificationMonitorSettings, classificationReports, collectionRules, libraryAssets, libraryBooks, readingEvents, readingGoals, wantToReadItems } from "../drizzle/schema";
import type { LibrarySnapshot } from "./db";

type RestoreDb = { delete: any; insert: any };
const bookRow = (userId: number, book: LibrarySnapshot["books"][number]) => ({ userId, uid: book.uid, raw: book.raw, title: book.title, author: book.author, media: book.media, genre: book.genre, slug: book.slug, volume: book.volume, collection: book.collection, seriesCode: book.seriesCode, seriesNumber: book.seriesNumber, extension: book.extension, shinkoId: book.shinkoId, filename: book.filename, classification: book.classification, confidence: book.confidence, warningsJson: JSON.stringify(book.warnings), duplicate: book.duplicate ? 1 : 0 });
const ruleRow = (userId: number, rule: LibrarySnapshot["rules"][number]) => ({ userId, uid: rule.uid, name: rule.name, matcher: rule.matcher, collection: rule.collection, seriesCode: rule.seriesCode, media: rule.media, genre: rule.genre, defaultAuthor: rule.defaultAuthor, active: rule.active ? 1 : 0 });

export async function replaceLibrarySnapshot(db: RestoreDb, userId: number, snapshot: LibrarySnapshot) {
  const wantToRead = snapshot.wantToRead || [];
  const reports = snapshot.classificationReports || [];
  await db.delete(wantToReadItems).where(eq(wantToReadItems.userId, userId));
  await db.delete(classificationReports).where(eq(classificationReports.userId, userId));
  await db.delete(classificationMonitorSettings).where(eq(classificationMonitorSettings.userId, userId));
  await db.delete(readingGoals).where(eq(readingGoals.userId, userId));
  await db.delete(readingEvents).where(eq(readingEvents.userId, userId));
  await db.delete(bookMetadata).where(eq(bookMetadata.userId, userId));
  await db.delete(libraryAssets).where(eq(libraryAssets.userId, userId));
  await db.delete(collectionRules).where(eq(collectionRules.userId, userId));
  await db.delete(libraryBooks).where(eq(libraryBooks.userId, userId));
  if (snapshot.books.length) await db.insert(libraryBooks).values(snapshot.books.map((book) => bookRow(userId, book)));
  if (snapshot.rules.length) await db.insert(collectionRules).values(snapshot.rules.map((rule) => ruleRow(userId, rule)));
  if (snapshot.assets.length) await db.insert(libraryAssets).values(snapshot.assets.map((asset) => ({ userId, ...asset })));
  if (snapshot.metadata.length) await db.insert(bookMetadata).values(snapshot.metadata.map((metadata) => ({ userId, ...metadata })));
  if (snapshot.readingEvents.length) await db.insert(readingEvents).values(snapshot.readingEvents.map((event) => ({ userId, ...event })));
  if (snapshot.goals.length) await db.insert(readingGoals).values(snapshot.goals.map((goal) => ({ userId, ...goal })));
  if (wantToRead.length) await db.insert(wantToReadItems).values(wantToRead.map((item) => ({ userId, ...item })));
  if (snapshot.classificationMonitorSettings?.uid) await db.insert(classificationMonitorSettings).values({ userId, ...snapshot.classificationMonitorSettings, reportEnabled: snapshot.classificationMonitorSettings.reportEnabled ? 1 : 0, scheduleCronTaskUid: snapshot.classificationMonitorSettings.scheduleCronTaskUid || null });
  if (reports.length) await db.insert(classificationReports).values(reports.map((report) => ({ userId, uid: report.uid, source: report.source, periodStart: report.periodStart, periodEnd: report.periodEnd, totalBooks: report.totalBooks, generalCount: report.generalCount, reviewCount: report.reviewCount, generalPercentBasisPoints: report.generalPercentBasisPoints, exceeded: report.exceeded ? 1 : 0, summaryJson: JSON.stringify(report.summary) })));
}
