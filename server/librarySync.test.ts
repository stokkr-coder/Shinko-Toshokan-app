import { describe, expect, it } from "vitest";
import { localOnlyRecords, mergeByUid } from "../shared/librarySync";

describe("migração assistida entre acervo local e remoto", () => {
  const remote = [{ uid: "remote-1", title: "Na conta" }];
  const local = [{ uid: "remote-1", title: "Cópia local antiga" }, { uid: "local-2", title: "Somente neste dispositivo" }];

  it("mantém separado o registro local que ainda não existe na conta", () => {
    expect(localOnlyRecords(remote, local)).toEqual([{ uid: "local-2", title: "Somente neste dispositivo" }]);
  });

  it("preserva o remoto e acrescenta o registro local arquivado sem duplicação", () => {
    expect(mergeByUid(remote, local)).toEqual([{ uid: "remote-1", title: "Na conta" }, { uid: "local-2", title: "Somente neste dispositivo" }]);
  });
});
