import { describe, expect, it } from "vitest";
import { chooseRemoteCopy, restoreArchivedCopy } from "../shared/syncConflictFlow";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("fluxo de conflito local e remoto", () => {
  it("arquiva o cache local ao escolher a conta e o recupera depois sem perder registros", () => {
    const storage = memoryStorage();
    const remote = [{ uid: "remote-1", title: "Na conta" }];
    const localOnly = [{ uid: "local-2", title: "No navegador" }];

    const chosen = chooseRemoteCopy(storage, "archive", remote, localOnly);
    expect(chosen.visibleRecords).toEqual(remote);
    expect(JSON.parse(storage.getItem("archive") || "[]")).toEqual(localOnly);

    const recovered = restoreArchivedCopy(storage, "archive", chosen.visibleRecords);
    expect(recovered.restoredRecords).toEqual(localOnly);
    expect(recovered.mergedRecords).toEqual([...remote, ...localOnly]);
    expect(storage.getItem("archive")).toBeNull();
  });
});
