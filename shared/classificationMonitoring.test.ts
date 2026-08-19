import { describe, expect, it } from "vitest";
import { calculateClassificationMetrics, reportWindowStart } from "./classificationMonitoring";

describe("classificationMonitoring", () => {
  const books = [
    { uid: "1", title: "Crônicas do eclipse", raw: "Crônicas do eclipse - Autor A.epub", author: "AUTOR, A", media: "0L", genre: "60", collection: "", confidence: "Revisar" as const, warnings: ["Revise"] },
    { uid: "2", title: "Eclipse perdido", raw: "Eclipse perdido - Autor A.epub", author: "AUTOR, A", media: "0L", genre: "60", collection: "", confidence: "Revisar" as const, warnings: ["Revise"] },
    { uid: "3", title: "Perry Rhodan", raw: "Perry Rhodan - 1.epub", author: "AUTOR, B", media: "0L", genre: "41", collection: "Perry Rhodan", confidence: "Alta" as const, warnings: [] },
  ];

  it("conta Literatura Geral pendente e aponta padrões recorrentes", () => {
    const metrics = calculateClassificationMetrics(books, { count: 2, percent: 50 });

    expect(metrics.generalCount).toBe(2);
    expect(metrics.reviewCount).toBe(2);
    expect(metrics.generalPercentBasisPoints).toBe(6667);
    expect(metrics.exceeded).toBe(true);
    expect(metrics.summary.topAuthors[0]).toEqual({ label: "AUTOR, A", count: 2 });
    expect(metrics.summary.topTerms).toContainEqual({ label: "eclipse", count: 2 });
  });

  it("define janelas semanais e mensais estáveis para relatórios idempotentes", () => {
    const wednesday = new Date("2026-08-19T16:30:00.000Z");
    expect(new Date(reportWindowStart("weekly", wednesday)).toISOString()).toBe("2026-08-17T00:00:00.000Z");
    expect(new Date(reportWindowStart("monthly", wednesday)).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
