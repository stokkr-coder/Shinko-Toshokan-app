import { describe, expect, it } from "vitest";
import { catalogationDiagnostics } from "./Home";

describe("regras de catalogação para volumes e séries", () => {
  it("distingue partes do mesmo volume de Patrística no identificador Shinko", () => {
    const partOne = catalogationDiagnostics.parseRawBook("Patrística Vol. 27_1 - Comentário as cartas de Sao Paulo - Sao Joao Crisóstomo");
    const partTwo = catalogationDiagnostics.parseRawBook("Patrística Vol. 27_2 - Comentário as cartas de Sao Paulo - Sao Joao Crisóstomo");
    const partThree = catalogationDiagnostics.parseRawBook("Patrística Vol. 27_3 - Comentário as cartas de Sao Paulo - Sao Joao Crisóstomo");

    expect([partOne.volume, partTwo.volume, partThree.volume]).toEqual(["27.01", "27.02", "27.03"]);
    expect(new Set([partOne.shinkoId, partTwo.shinkoId, partThree.shinkoId]).size).toBe(3);
    expect(partTwo.seriesNumber).toBe("Vol. 27 · parte 02");
  });

  it("extrai coleção, número e título de séries escritas entre colchetes", () => {
    const record = catalogationDiagnostics.parseRawBook("CHANDLER, A. Bertram - [Rim Worlds Derek Calver 01] The Rim of Space");

    expect(record.collection).toBe("Rim Worlds Derek Calver");
    expect(record.seriesCode).toBe("RIMW");
    expect(record.seriesNumber).toBe("Livro 01");
    expect(record.volume).toBe("01");
    expect(record.title).toBe("The Rim of Space");
  });
});
