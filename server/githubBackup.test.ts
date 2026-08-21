import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGitHubCatalogBackup, listGitHubCatalogBackups, readGitHubCatalogBackup, uploadGitHubCatalogBackup } from "./githubBackup";

const snapshot = {
  books: [{ uid: "livro-1", raw: "Livro de teste", title: "Livro de teste", author: "AUTOR, Teste", media: "0L", genre: "60", slug: "TEST", volume: "00", collection: "", seriesCode: "", seriesNumber: "", extension: "epub", shinkoId: "ST.0L.60.TEST-00", filename: "livro-de-teste.epub", classification: "Literatura Geral", confidence: "Revisar" as const, warnings: ["Classificação a revisar"], duplicate: false }],
  rules: [{ uid: "regra-1", name: "Teste", matcher: "teste", collection: "", seriesCode: "", media: "0L", genre: "60", defaultAuthor: "", active: true }],
};

const originalBackupToken = process.env.GITHUB_BACKUP_TOKEN;
beforeEach(() => { process.env.GITHUB_BACKUP_TOKEN = "token-de-teste"; });
afterEach(() => vi.restoreAllMocks());
afterAll(() => { if (originalBackupToken === undefined) delete process.env.GITHUB_BACKUP_TOKEN; else process.env.GITHUB_BACKUP_TOKEN = originalBackupToken; });

describe("backup GitHub do catálogo", () => {
  it("gera um documento portátil somente com lista e regras", () => {
    const document = buildGitHubCatalogBackup(snapshot, new Date("2026-08-18T12:00:00.000Z"));
    expect(document).toMatchObject({ format: "biblioteca-shinko-catalogo", version: 1, counts: { books: 1, rules: 1 } });
    expect(document.books[0]).toMatchObject({ uid: "livro-1", shinkoId: "ST.0L.60.TEST-00" });
    expect(document).not.toHaveProperty("assets");
  });

  it("salva primeiro a versão datada e depois a cópia atual", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { path: "backups/2026-08-18/catalogo.json" }, commit: { sha: "commit-datado" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { path: "latest/catalogo.json" }, commit: { sha: "commit-atual" } }), { status: 201 }));

    const result = await uploadGitHubCatalogBackup(snapshot, new Date("2026-08-18T12:00:00.000Z"));

    expect(result).toMatchObject({ path: "backups/2026-08-18/catalogo.json", latestPath: "latest/catalogo.json", commitSha: "commit-atual", counts: { books: 1, rules: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0][0])).toContain("backups/2026-08-18/catalogo.json");
    expect(String(fetchMock.mock.calls[2][0])).toContain("latest/catalogo.json");
  });

  it("lista apenas versões datadas e lê uma versão compatível", async () => {
    const document = buildGitHubCatalogBackup(snapshot, new Date("2026-08-18T12:00:00.000Z"));
    const content = Buffer.from(JSON.stringify(document)).toString("base64");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ private: true, full_name: "stokkr-coder/Shinko-Toshokan", default_branch: "main" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [{ path: "backups/2026-08-17/catalogo.json", type: "blob", size: 320 }, { path: "backups/notas.txt", type: "blob", size: 20 }, { path: "backups/2026-08-18/catalogo.json", type: "blob", size: 340 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ encoding: "base64", content }), { status: 200 }));

    await expect(listGitHubCatalogBackups()).resolves.toEqual([{ path: "backups/2026-08-18/catalogo.json", size: 340 }, { path: "backups/2026-08-17/catalogo.json", size: 320 }]);
    await expect(readGitHubCatalogBackup("backups/2026-08-18/catalogo.json")).resolves.toMatchObject({ path: "backups/2026-08-18/catalogo.json", catalog: { counts: { books: 1, rules: 1 } } });
    await expect(readGitHubCatalogBackup("latest/catalogo.json")).rejects.toThrow("backup datado válido");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("usa a resposta bruta quando o GitHub omite base64 em snapshots grandes", async () => {
    const document = buildGitHubCatalogBackup(snapshot, new Date("2026-08-18T12:00:00.000Z"));
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ encoding: "none" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 200 }));

    await expect(readGitHubCatalogBackup("backups/2026-08-18/catalogo.json")).resolves.toMatchObject({ catalog: { counts: { books: 1, rules: 1 } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Accept: "application/vnd.github.raw+json" });
  });
});
