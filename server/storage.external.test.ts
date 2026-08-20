import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ authProvider: "google", forgeApiUrl: "", forgeApiKey: "" }));

vi.mock("./_core/env", () => ({ ENV: env }));

import { hasManagedStorage, storagePut } from "./storage";

describe("armazenamento na variante externa", () => {
  it("identifica a ausência do armazenamento gerenciado", () => {
    expect(hasManagedStorage()).toBe(false);
  });

  it("explica que anexos digitais precisam de um link ou da versão Manus", async () => {
    await expect(storagePut("library/teste.epub", "conteúdo", "application/epub+zip")).rejects.toThrow(
      "O envio de arquivos digitais não está configurado nesta versão externa",
    );
  });
});
