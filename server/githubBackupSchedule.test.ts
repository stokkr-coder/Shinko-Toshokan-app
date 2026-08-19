import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ authenticateRequest: vi.fn(), findBySchedule: vi.fn(), snapshot: vi.fn(), record: vi.fn(), upload: vi.fn() }));

vi.mock("./db", () => ({ getGitHubBackupSettingsBySchedule: state.findBySchedule, getLibrarySnapshot: state.snapshot, recordGitHubBackupResult: state.record }));
vi.mock("./githubBackup", () => ({ uploadGitHubCatalogBackup: state.upload }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: state.authenticateRequest } }));

import { registerGitHubBackupSchedule } from "./githubBackupSchedule";

function setup() {
  let handler: ((req: any, res: any) => Promise<unknown>) | undefined;
  registerGitHubBackupSchedule({ post: (_path: string, nextHandler: typeof handler) => { handler = nextHandler; } } as any);
  if (!handler) throw new Error("Rota agendada não foi registrada.");
  const body: unknown[] = [];
  const response = { status: vi.fn(() => response), json: vi.fn((value: unknown) => { body.push(value); return response; }) };
  return { handler, response, body };
}

describe("backup GitHub agendado", () => {
  it("recusa chamadas sem identidade cron", async () => {
    state.authenticateRequest.mockResolvedValueOnce({ isCron: false, taskUid: null });
    const { handler, response, body } = setup();
    await handler({ path: "/api/scheduled/github-backup" }, response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(body).toEqual([{ error: "cron-only" }]);
  });

  it("ignora tarefas órfãs ou pausadas", async () => {
    state.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "cron-orphan" });
    state.findBySchedule.mockResolvedValueOnce(null);
    const orphan = setup();
    await orphan.handler({ path: "/api/scheduled/github-backup" }, orphan.response);
    expect(orphan.body).toEqual([{ ok: true, skipped: "orphan" }]);

    state.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "cron-paused" });
    state.findBySchedule.mockResolvedValueOnce({ userId: 7, settings: { enabled: false } });
    const paused = setup();
    await paused.handler({ path: "/api/scheduled/github-backup" }, paused.response);
    expect(paused.body).toEqual([{ ok: true, skipped: "disabled" }]);
  });

  it("gera e registra o resultado para a tarefa cron associada", async () => {
    state.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "cron-7" });
    state.findBySchedule.mockResolvedValueOnce({ userId: 7, settings: { enabled: true } });
    state.snapshot.mockResolvedValueOnce({ books: [{ uid: "book-1" }], rules: [{ uid: "rule-1" }] });
    state.upload.mockResolvedValueOnce({ path: "backups/2026-08-18/catalogo.json", commitSha: "commit-1", createdAt: "2026-08-18T09:00:00.000Z", counts: { books: 1, rules: 1 } });
    const { handler, response, body } = setup();
    await handler({ path: "/api/scheduled/github-backup" }, response);

    expect(state.snapshot).toHaveBeenCalledWith(7);
    expect(state.upload).toHaveBeenCalledWith({ books: [{ uid: "book-1" }], rules: [{ uid: "rule-1" }] });
    expect(state.record).toHaveBeenCalledWith(7, expect.objectContaining({ commitSha: "commit-1" }));
    expect(body).toEqual([expect.objectContaining({ ok: true, path: "backups/2026-08-18/catalogo.json" })]);
  });
});
