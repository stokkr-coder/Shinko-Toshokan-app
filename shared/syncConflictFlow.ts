import { archiveLocalRecords, clearLocalArchive, readLocalArchive } from "./localArchive";
import { mergeByUid, type SyncIdentity } from "./librarySync";

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function chooseRemoteCopy<T extends SyncIdentity>(storage: BrowserStorage, archiveKey: string, remoteRecords: T[], localOnlyRecords: T[]) {
  archiveLocalRecords(storage, archiveKey, localOnlyRecords);
  return { visibleRecords: remoteRecords, archivedRecords: localOnlyRecords };
}

export function restoreArchivedCopy<T extends SyncIdentity>(storage: BrowserStorage, archiveKey: string, visibleRecords: T[]) {
  const archivedRecords = readLocalArchive<T>(storage, archiveKey);
  const mergedRecords = mergeByUid(visibleRecords, archivedRecords);
  clearLocalArchive(storage, archiveKey);
  return { mergedRecords, restoredRecords: archivedRecords };
}
