import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ authProvider: "google" }));

vi.mock("./_core/env", () => ({ ENV: env }));

import { sanitizeExternalSnapshot } from "./db";

describe("importação de snapshot externo", () => {
  afterEach(() => { env.authProvider = "google"; });

  it("remove referências Manus de capas e arquivos antes da persistência", () => {
    const snapshot = {
      books: [], rules: [], readingEvents: [], goals: [], wantToRead: [], classificationMonitorSettings: null, classificationReports: [],
      assets: [{ uid: "asset-1", bookUid: "book-1", kind: "digital-file" as const, label: "EPUB", location: "", sourceUrl: "", storageKey: "library/livro.epub", storageUrl: "/manus-storage/library/livro.epub", mimeType: "application/epub+zip", byteSize: 12 }],
      metadata: [{ bookUid: "book-1", isbn: "9780000000000", subtitle: "", publisher: "", publishedDate: "", pageCount: 0, summary: "", coverUrl: "/manus-storage/library/capa.jpg", coverStorageKey: "library/capa.jpg", source: "Open Library", sourceUrl: "https://openlibrary.org" }],
    };

    const sanitized = sanitizeExternalSnapshot(snapshot);

    expect(sanitized.assets[0]).toMatchObject({ storageKey: "", storageUrl: "" });
    expect(sanitized.metadata[0]).toMatchObject({ coverStorageKey: "", coverUrl: "" });
  });
});
