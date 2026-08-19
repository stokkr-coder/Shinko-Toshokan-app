import { describe, expect, it } from "vitest";
import { localOnlyRecords, mergeByUid } from "./librarySync";

describe("sincronização de acervo", () => {
  const remote = [{ uid: "remote-1", title: "Na nuvem" }];
  const local = [{ uid: "remote-1", title: "Cópia local antiga" }, { uid: "local-2", title: "Somente neste dispositivo" }];

  it("identifica registros locais que ainda não existem na conta", () => {
    expect(localOnlyRecords(remote, local)).toEqual([{ uid: "local-2", title: "Somente neste dispositivo" }]);
  });

  it("une acervos sem substituir ou duplicar o registro remoto", () => {
    expect(mergeByUid(remote, local)).toEqual([{ uid: "remote-1", title: "Na nuvem" }, { uid: "local-2", title: "Somente neste dispositivo" }]);
  });
});
