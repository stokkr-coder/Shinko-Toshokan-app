import { describe, expect, it } from "vitest";
import { bookMetadata, classificationMonitorSettings, classificationReports, collectionRules, libraryAssets, libraryBooks, readingEvents, readingGoals, wantToReadItems } from "../drizzle/schema";
import { replaceLibrarySnapshot } from "./restoreLibrary";

const snapshot = {
  books: [{ uid: "book-1", raw: "Livro", title: "Livro", author: "AUTOR, Nome", media: "0L", genre: "60", slug: "AUTO", volume: "01", collection: "Coleção", seriesCode: "COL", seriesNumber: "Vol. 01", extension: "epub", shinkoId: "ST.0L.60.AUTO-01", filename: "livro.epub", classification: "Literatura", confidence: "Alta" as const, warnings: ["Revisado"], duplicate: false }],
  rules: [{ uid: "rule-1", name: "Coleção", matcher: "Coleção", collection: "Coleção", seriesCode: "COL", media: "0L", genre: "60", defaultAuthor: "", active: true }],
  assets: [{ uid: "asset-1", bookUid: "book-1", kind: "physical" as const, label: "Exemplar físico", location: "Estante A", sourceUrl: "", storageKey: "", storageUrl: "", mimeType: "", byteSize: 0 }],
  metadata: [],
  readingEvents: [],
  goals: [],
  wantToRead: [{ uid: "want-1", bookUid: "book-1", priority: "Alta" as const, note: "Começar pelo volume um", position: 0 }],
  classificationMonitorSettings: { uid: "monitor-1", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: true, scheduleCronTaskUid: "cron-1", lastReportAt: null },
  classificationReports: [{ uid: "report-1", source: "manual" as const, periodStart: 1_700_000_000_000, periodEnd: 1_700_000_100_000, totalBooks: 1, generalCount: 1, reviewCount: 1, generalPercentBasisPoints: 10_000, exceeded: true, summary: { topAuthors: [{ label: "AUTOR, Nome", count: 1 }], topTerms: [], topCollections: [], generalBookUids: ["book-1"] } }],
};

describe("restauração de acervo", () => {
  it("remove o estado anterior e reinsere livros, regras, exemplares e planejamento do snapshot", async () => {
    const operations: Array<{ kind: string; table: unknown; values?: unknown }> = [];
    const db = {
      delete: (table: unknown) => ({ where: async () => { operations.push({ kind: "delete", table }); } }),
      insert: (table: unknown) => ({ values: async (values: unknown) => { operations.push({ kind: "insert", table, values }); } }),
    };
    await replaceLibrarySnapshot(db, 42, snapshot);

    expect(operations.slice(0, 9)).toEqual([{ kind: "delete", table: wantToReadItems }, { kind: "delete", table: classificationReports }, { kind: "delete", table: classificationMonitorSettings }, { kind: "delete", table: readingGoals }, { kind: "delete", table: readingEvents }, { kind: "delete", table: bookMetadata }, { kind: "delete", table: libraryAssets }, { kind: "delete", table: collectionRules }, { kind: "delete", table: libraryBooks }]);
    expect(operations).toHaveLength(15);
    expect(operations[9]).toMatchObject({ kind: "insert", table: libraryBooks, values: [expect.objectContaining({ userId: 42, uid: "book-1", warningsJson: "[\"Revisado\"]" })] });
    expect(operations[10]).toMatchObject({ kind: "insert", table: collectionRules, values: [expect.objectContaining({ userId: 42, uid: "rule-1", active: 1 })] });
    expect(operations[11]).toMatchObject({ kind: "insert", table: libraryAssets, values: [expect.objectContaining({ userId: 42, bookUid: "book-1", uid: "asset-1" })] });
    expect(operations[12]).toMatchObject({ kind: "insert", table: wantToReadItems, values: [expect.objectContaining({ userId: 42, uid: "want-1", priority: "Alta" })] });
    expect(operations[13]).toMatchObject({ kind: "insert", table: classificationMonitorSettings, values: expect.objectContaining({ userId: 42, uid: "monitor-1", reportEnabled: 1 }) });
    expect(operations[14]).toMatchObject({ kind: "insert", table: classificationReports, values: [expect.objectContaining({ userId: 42, uid: "report-1", source: "manual", exceeded: 1 })] });
  });
});
