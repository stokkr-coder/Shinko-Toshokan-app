import { describe, expect, it } from "vitest";
import { deriveReadingNow } from "../shared/readingNow";

const books = [{ uid: "a", title: "Em curso", author: "AUTOR, Um" }, { uid: "b", title: "Concluído", author: "AUTOR, Dois" }, { uid: "c", title: "Pausado", author: "AUTOR, Três" }];

describe("estante lendo agora", () => {
  it("mostra apenas livros cujo último status de leitura está ativo", () => {
    const items = deriveReadingNow(books, [{ bookUid: "a", coverUrl: "capa.jpg" }], [
      { bookUid: "a", type: "started", progress: 0, page: 0, note: "", occurredAt: 1 },
      { bookUid: "a", type: "progress", progress: 42, page: 118, note: "Capítulo 5", occurredAt: 3 },
      { bookUid: "b", type: "finished", progress: 100, page: 220, note: "", occurredAt: 4 },
      { bookUid: "c", type: "abandoned", progress: 30, page: 80, note: "", occurredAt: 5 },
    ]);
    expect(items).toEqual([expect.objectContaining({ uid: "a", progress: 42, page: 118, coverUrl: "capa.jpg", note: "Capítulo 5", lastUpdated: 3 })]);
  });

  it("mantém a leitura ativa quando uma anotação é o evento mais recente", () => {
    const items = deriveReadingNow(books.slice(0, 1), [], [
      { bookUid: "a", type: "progress", progress: 20, page: 54, note: "", occurredAt: 1 },
      { bookUid: "a", type: "note", progress: 20, page: 54, note: "Retomar amanhã", occurredAt: 2 },
    ]);
    expect(items[0]).toMatchObject({ uid: "a", progress: 20, note: "Retomar amanhã", lastUpdated: 2 });
  });
});
