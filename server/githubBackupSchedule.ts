import type { Express, Request, Response } from "express";
import { getGitHubBackupSettingsBySchedule, getLibrarySnapshot, recordGitHubBackupResult } from "./db";
import { uploadGitHubCatalogBackup } from "./githubBackup";
import { sdk } from "./_core/sdk";

export async function runGitHubCatalogBackup(userId: number) {
  const snapshot = await getLibrarySnapshot(userId);
  try {
    const result = await uploadGitHubCatalogBackup({ books: snapshot.books, rules: snapshot.rules });
    await recordGitHubBackupResult(userId, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordGitHubBackupResult(userId, null, message);
    throw error;
  }
}

export function registerGitHubBackupSchedule(app: Express) {
  app.post("/api/scheduled/github-backup", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const owner = await getGitHubBackupSettingsBySchedule(user.taskUid);
      if (!owner || !owner.settings.enabled) return res.json({ ok: true, skipped: owner ? "disabled" : "orphan" });
      const result = await runGitHubCatalogBackup(owner.userId);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[GitHub backup schedule]", error);
      return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
}
