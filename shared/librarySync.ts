export type SyncIdentity = { uid: string };

export function localOnlyRecords<T extends SyncIdentity>(remote: T[], local: T[]) {
  const remoteUids = new Set(remote.map((record) => record.uid));
  return local.filter((record) => !remoteUids.has(record.uid));
}

export function mergeByUid<T extends SyncIdentity>(remote: T[], local: T[]) {
  return [...remote, ...localOnlyRecords(remote, local)];
}
