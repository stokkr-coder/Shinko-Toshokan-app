import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  findBySchedule: vi.fn(),
  createScheduledReport: vi.fn(),
}));

vi.mock("./db", () => ({
  getClassificationMonitorSettingsBySchedule: state.findBySchedule,
  createScheduledClassificationReport: state.createScheduledReport,
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: state.authenticateRequest } }));

import { registerClassificationReportSchedule } from "./classificationReportSchedule";

function setup() {
  let handler: ((req: any, res: any) => Promise<unknown>) | undefined;
  registerClassificationReportSchedule({ post: (_path: string, nextHandler: typeof handler) => { handler = nextHandler; } } as any);
  if (!handler) throw new Error("Rota agendada não foi registrada.");
  const body: unknown[] = [];
  const response = { status: vi.fn(() => response), json: vi.fn((value: unknown) => { body.push(value); return response; }) };
  return { handler, response, body };
}

describe("relatório agendado de classificação", () => {
  it("recusa chamadas sem identidade cron", async () => {
    state.authenticateRequest.mockResolvedValueOnce({ isCron: false, taskUid: null });
    const { handler, response, body } = setup();
    await handler({ path: "/api/scheduled/classification-report" }, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(body).toEqual([{ error: "cron-only" }]);
  });

  it("localiza a tarefa cron e devolve o resultado idempotente do relatório", async () => {
    state.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "cron-42" });
    state.findBySchedule.mockResolvedValueOnce({ userId: 42, settings: {} });
    state.createScheduledReport.mockResolvedValueOnce({ skipped: "already-generated", report: { uid: "report-1" } });
    const { handler, response, body } = setup();
    await handler({ path: "/api/scheduled/classification-report" }, response);

    expect(state.findBySchedule).toHaveBeenCalledWith("cron-42");
    expect(state.createScheduledReport).toHaveBeenCalledWith(42);
    expect(body).toEqual([{ ok: true, skipped: "already-generated", report: { uid: "report-1" } }]);
  });
});
