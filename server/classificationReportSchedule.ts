import type { Express, Request, Response } from "express";
import { createScheduledClassificationReport, getClassificationMonitorSettingsBySchedule } from "./db";
import { sdk } from "./_core/sdk";

export function registerClassificationReportSchedule(app: Express) {
  app.post("/api/scheduled/classification-report", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        return res.status(403).json({ error: "cron-only" });
      }
      const monitor = await getClassificationMonitorSettingsBySchedule(user.taskUid);
      if (!monitor) {
        return res.json({ ok: true, skipped: "orphan" });
      }
      const result = await createScheduledClassificationReport(monitor.userId);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Classification report schedule]", error);
      return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
}
