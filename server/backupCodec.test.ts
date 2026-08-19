import { describe, expect, it } from "vitest";
import { deserializeLibrarySnapshot, serializeLibrarySnapshot } from "./backupCodec";

const snapshot = {
  books: [{ uid: "book-1", raw: "Duna 1", title: "Duna", author: "HERBERT, Frank", media: "0L", genre: "41", slug: "HERB", volume: "01", collection: "Duna", seriesCode: "DUNA", seriesNumber: "Livro 01", extension: "epub", shinkoId: "ST.0L.41.HERB-01", filename: "duna.epub", classification: "Ficção Científica", confidence: "Alta" as const, warnings: [], duplicate: false }],
  rules: [{ uid: "rule-1", name: "Duna", matcher: "Duna", collection: "Duna", seriesCode: "DUNA", media: "0L", genre: "41", defaultAuthor: "HERBERT, Frank", active: true }],
  assets: [{ uid: "asset-1", bookUid: "book-1", kind: "physical" as const, label: "Capa dura", location: "Estante A · 3", sourceUrl: "", storageKey: "", storageUrl: "", mimeType: "", byteSize: 0 }],
  metadata: [],
  readingEvents: [],
  goals: [],
  wantToRead: [{ uid: "want-1", bookUid: "book-1", priority: "Alta" as const, note: "Retomar a série", position: 0 }],
  classificationMonitorSettings: { uid: "monitor-1", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly" as const, reportEnabled: true, scheduleCronTaskUid: "cron-1", lastReportAt: null },
  classificationReports: [{ uid: "report-1", source: "manual" as const, periodStart: 1_700_000_000_000, periodEnd: 1_700_000_100_000, totalBooks: 1, generalCount: 0, reviewCount: 0, generalPercentBasisPoints: 0, exceeded: false, summary: { topAuthors: [], topTerms: [], topCollections: [], generalBookUids: [] } }],
};

describe("codec de backup", () => {
  it("preserva livros, regras, exemplares e planejamento de leitura em uma restauração de snapshot", () => {
    expect(deserializeLibrarySnapshot(serializeLibrarySnapshot(snapshot))).toEqual(snapshot);
  });

  it("rejeita cópias corrompidas ou sem a estrutura necessária", () => {
    expect(() => deserializeLibrarySnapshot("{incompleto")).toThrow("corrompida");
    expect(() => deserializeLibrarySnapshot(JSON.stringify({ books: [], rules: [] }))).toThrow("estrutura esperada");
  });
});
