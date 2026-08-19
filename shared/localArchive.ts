type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLocalArchive<T>(storage: BrowserStorage, key: string): T[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function archiveLocalRecords<T>(storage: BrowserStorage, key: string, records: T[]) {
  storage.setItem(key, JSON.stringify(records));
}

export function clearLocalArchive(storage: BrowserStorage, key: string) {
  storage.removeItem(key);
}
