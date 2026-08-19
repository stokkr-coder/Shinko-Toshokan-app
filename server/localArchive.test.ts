import { describe, expect, it } from "vitest";
import { archiveLocalRecords, clearLocalArchive, readLocalArchive } from "../shared/localArchive";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("arquivo local de sincronização", () => {
  it("preserva registros locais ao arquivar e os recupera sem alteração", () => {
    const storage = memoryStorage();
    const records = [{ uid: "local-1", title: "Livro local" }];
    archiveLocalRecords(storage, "archive", records);
    expect(readLocalArchive<typeof records[number]>(storage, "archive")).toEqual(records);
  });

  it("remove o arquivo local apenas após a recuperação confirmada", () => {
    const storage = memoryStorage();
    archiveLocalRecords(storage, "archive", [{ uid: "local-1" }]);
    clearLocalArchive(storage, "archive");
    expect(readLocalArchive(storage, "archive")).toEqual([]);
  });
});
