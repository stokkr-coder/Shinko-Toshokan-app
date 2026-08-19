import type { LibrarySnapshot } from "./db";

function isSnapshot(value: unknown): value is LibrarySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<LibrarySnapshot>;
  const validRecords = (items: unknown, keys: string[]) => Array.isArray(items) && items.every((item) => item && typeof item === "object" && keys.every((key) => typeof (item as Record<string, unknown>)[key] === "string"));
  return validRecords(snapshot.books, ["uid", "title", "shinkoId"]) && validRecords(snapshot.rules, ["uid", "name", "matcher"]) && validRecords(snapshot.assets, ["uid", "bookUid", "kind", "label"]);
}

export function serializeLibrarySnapshot(snapshot: LibrarySnapshot) { return JSON.stringify(snapshot); }
export function deserializeLibrarySnapshot(serialized: string): LibrarySnapshot {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { throw new Error("A cópia de segurança está corrompida."); }
  if (!isSnapshot(parsed)) throw new Error("A cópia de segurança não possui a estrutura esperada.");
  const snapshot = parsed as Partial<LibrarySnapshot>;
  return { ...snapshot, metadata: Array.isArray(snapshot.metadata) ? snapshot.metadata : [], readingEvents: Array.isArray(snapshot.readingEvents) ? snapshot.readingEvents : [], goals: Array.isArray(snapshot.goals) ? snapshot.goals : [], wantToRead: Array.isArray(snapshot.wantToRead) ? snapshot.wantToRead : [], classificationMonitorSettings: snapshot.classificationMonitorSettings || { uid: "", alertThresholdCount: 10, alertThresholdPercent: 5, reportFrequency: "weekly", reportEnabled: true, scheduleCronTaskUid: "", lastReportAt: null }, classificationReports: Array.isArray(snapshot.classificationReports) ? snapshot.classificationReports : [] } as LibrarySnapshot;
}
