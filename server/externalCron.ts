import type { Express, Request, Response } from "express";
import { createScheduledClassificationReport, getClassificationMonitorSettings, getExternalLibraryOwner, getGitHubBackupSettings } from "./db";
import { runGitHubCatalogBackup } from "./githubBackupSchedule";

function isAuthorized(req: Request) {
  const secret = process.env.EXTERNAL_CRON_SECRET || "";
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

export function registerExternalCronRoutes(app: Express) {
  app.post("/api/external-cron/github-backup", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const owner = await getExternalLibraryOwner();
      if (!owner) return res.status(409).json({ error: "owner-not-initialized" });
      const settings = await getGitHubBackupSettings(owner.id);
      if (!settings.enabled) return res.json({ ok: true, skipped: "disabled" });
      const result = await runGitHubCatalogBackup(owner.id);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[External GitHub backup]", error);
      return res.status(500).json({ error: message, context: { path: req.path } });
    }
  });

  app.post("/api/external-cron/classification-report", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const owner = await getExternalLibraryOwner();
      if (!owner) return res.status(409).json({ error: "owner-not-initialized" });
      const settings = await getClassificationMonitorSettings(owner.id);
      if (!settings.reportEnabled) return res.json({ ok: true, skipped: "disabled" });
      const result = await createScheduledClassificationReport(owner.id);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[External classification report]", error);
      return res.status(500).json({ error: message, context: { path: req.path } });
    }
  });
}
