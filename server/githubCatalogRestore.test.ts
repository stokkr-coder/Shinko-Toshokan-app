import { describe, expect, it } from "vitest";
import { mergeGitHubCatalogSnapshot, type LibrarySnapshot } from "./db";
import type { GitHubCatalogSnapshot } from "./githubBackup";

const retainedBook = { uid: "book-retained", raw: "Catálogo restaurado", title: "Catálogo restaurado", author: "AUTOR, Retido", media: "0L", genre: "60", slug: "RETI", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.RETI-00", filename: "retido.epub", classification: "Literatura Geral", confidence: "Alta" as const, warnings: [], duplicate: false };
const removedBook = { ...retainedBook, uid: "book-removed", title: "Livro ausente", shinkoId: "ST.0L.60.AUSE-00" };
const restoredRule = { uid: "rule-restored", name: "Restaurada", matcher: "restaurada", collection: "", seriesCode: "", media: "0L", genre: "60", defaultAuthor: "", active: true };

describe("restauração do catálogo GitHub", () => {
  it("substitui livros e regras, remove vínculos órfãos e preserva metas e monitoramento", () => {
    const current = {
      books: [retainedBook, removedBook], rules: [{ ...restoredRule, uid: "rule-current" }],
      assets: [{ uid: "asset-kept", bookUid: "book-retained" }, { uid: "asset-removed", bookUid: "book-removed" }],
      metadata: [{ bookUid: "book-retained", isbn: "1" }, { bookUid: "book-removed", isbn: "2" }],
      readingEvents: [{ uid: "reading-kept", bookUid: "book-retained" }, { uid: "reading-removed", bookUid: "book-removed" }],
      goals: [{ uid: "goal-2026", period: "yearly", periodKey: "2026", targetBooks: 12 }],
      wantToRead: [{ uid: "want-kept", bookUid: "book-retained" }, { uid: "want-removed", bookUid: "book-removed" }],
      classificationMonitorSettings: { uid: "monitor", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly", reportEnabled: true, scheduleCronTaskUid: "task-1", lastReportAt: null },
      classificationReports: [{ uid: "report-1" }],
    } as LibrarySnapshot;
    const catalog: GitHubCatalogSnapshot = { books: [retainedBook], rules: [restoredRule] };

    const result = mergeGitHubCatalogSnapshot(current, catalog);

    expect(result.books).toEqual([retainedBook]);
    expect(result.rules).toEqual([restoredRule]);
    expect(result.assets.map((asset) => asset.uid)).toEqual(["asset-kept"]);
    expect(result.metadata.map((metadata) => metadata.bookUid)).toEqual(["book-retained"]);
    expect(result.readingEvents.map((event) => event.uid)).toEqual(["reading-kept"]);
    expect(result.wantToRead.map((item) => item.uid)).toEqual(["want-kept"]);
    expect(result.goals).toEqual(current.goals);
    expect(result.classificationMonitorSettings).toEqual(current.classificationMonitorSettings);
    expect(result.classificationReports).toEqual(current.classificationReports);
  });
});
