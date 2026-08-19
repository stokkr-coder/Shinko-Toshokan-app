import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storagePut: vi.fn(async () => ({ key: "library/cover.jpg", url: "/manus-storage/library/cover.jpg" })) }));
import { lookupIsbn } from "./isbn";

describe("consulta ISBN", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejeita formatos que não correspondem a ISBN-10 ou ISBN-13", async () => {
    await expect(lookupIsbn("ISBN incompleto")).rejects.toThrow("ISBN-10 ou ISBN-13 válido");
  });

  it("normaliza os metadados disponíveis e aceita ISBN com separadores", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ "ISBN:9780385472579": { title: "Zen speaks", subtitle: "shouts of nothingness", authors: [{ name: "Zhizhong Cai" }], publishers: [{ name: "Anchor Books" }], publish_date: "1994", number_of_pages: 159, subjects: [{ name: "Zen Buddhism" }], cover: { large: "https://covers.example/zen.jpg" }, url: "http://openlibrary.org/books/OL1397864M/Zen_speaks" } }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await lookupIsbn("978-0-385-47257-9");
    expect(result).toMatchObject({ isbn: "9780385472579", title: "Zen speaks", authors: ["Zhizhong Cai"], publisher: "Anchor Books", pageCount: 159, coverUrl: "https://covers.example/zen.jpg", source: "Open Library" });
    expect(result.sourceUrl).toMatch(/^https:/);
  });

  it("informa quando a fonte não retorna o ISBN solicitado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(lookupIsbn("9780385472579")).rejects.toThrow("ISBN não encontrado");
  });
});
