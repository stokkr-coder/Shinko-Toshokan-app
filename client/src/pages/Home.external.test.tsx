import { afterEach, describe, expect, it, vi } from "vitest";
import { asBookMetadata, asLinkedAsset } from "./Home";

describe("dados herdados do Manus na hospedagem externa", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("remove URLs internas e sinaliza anexos que continuam apenas na cópia Manus", () => {
    vi.stubEnv("VITE_AUTH_PROVIDER", "google");

    expect(asBookMetadata({ bookUid: "livro-1", isbn: "9780000000000", subtitle: "", publisher: "", publishedDate: "", pageCount: 0, summary: "", coverUrl: "/manus-storage/library/capa.jpg", coverStorageKey: "library/capa.jpg", source: "Open Library", sourceUrl: "https://openlibrary.org" })).toMatchObject({ coverUrl: "", coverStorageKey: "" });
    expect(asLinkedAsset({ uid: "asset-1", bookUid: "livro-1", kind: "digital-file", label: "EPUB", location: "", sourceUrl: "", storageKey: "library/livro.epub", storageUrl: "/manus-storage/library/livro.epub", mimeType: "application/epub+zip", byteSize: 20 })).toMatchObject({ storageUrl: "", storageKey: "", location: expect.stringContaining("indisponível nesta versão externa") });
  });
});
