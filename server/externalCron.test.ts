import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExternalLibraryOwner: vi.fn(),
  getGitHubBackupSettings: vi.fn(),
  getClassificationMonitorSettings: vi.fn(),
  runGitHubCatalogBackup: vi.fn(),
  createScheduledClassificationReport: vi.fn(),
}));

vi.mock("./db", () => ({
  getExternalLibraryOwner: mocks.getExternalLibraryOwner,
  getGitHubBackupSettings: mocks.getGitHubBackupSettings,
  getClassificationMonitorSettings: mocks.getClassificationMonitorSettings,
  createScheduledClassificationReport: mocks.createScheduledClassificationReport,
}));

vi.mock("./githubBackupSchedule", () => ({
  runGitHubCatalogBackup: mocks.runGitHubCatalogBackup,
}));

import { registerExternalCronRoutes } from "./externalCron";

function registerRoutes() {
  const handlers = new Map<string, (req: any, res: any) => Promise<unknown>>();
  registerExternalCronRoutes({ post: vi.fn((path, handler) => handlers.set(path, handler)) } as any);
  return handlers;
}

function createResponse() {
  const response: any = { json: vi.fn() };
  response.status = vi.fn(() => response);
  return response;
}

describe("external cron routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.EXTERNAL_CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns a controlled 500 response when the external GitHub backup fails", async () => {
    mocks.getExternalLibraryOwner.mockResolvedValue({ id: 1 });
    mocks.getGitHubBackupSettings.mockResolvedValue({ enabled: true });
    mocks.runGitHubCatalogBackup.mockRejectedValue(new Error("GitHub token rejected"));
    const response = createResponse();

    await registerRoutes().get("/api/external-cron/github-backup")!({
      headers: { authorization: "Bearer test-cron-secret" },
      path: "/api/external-cron/github-backup",
    }, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "GitHub token rejected",
      context: { path: "/api/external-cron/github-backup" },
    });
  });
});
