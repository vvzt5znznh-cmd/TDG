import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { parseTDGFileText, serializeTDGFile } from "../schema/parse";
import { isScenario, type TDGFile } from "../schema/types";

const DB_NAME = "tdg-builder";
const MAX_RECENT = 8;

interface CacheRecord {
  json: string;
  fileName: string | null;
  dirty: boolean;
  updated: string;
}

export interface RecentRecord {
  id: string;
  title: string;
  fileName: string | null;
  modified: string;
  json: string;
}

interface TDGBuilderDB extends DBSchema {
  current: {
    key: "draft";
    value: CacheRecord;
  };
  recent: {
    key: string;
    value: RecentRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<TDGBuilderDB>> | null = null;

function getDb(): Promise<IDBPDatabase<TDGBuilderDB>> {
  dbPromise ??= openDB<TDGBuilderDB>(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("current")) {
        database.createObjectStore("current");
      }
      if (!database.objectStoreNames.contains("recent")) {
        database.createObjectStore("recent", { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

export async function cacheDraft(file: TDGFile, fileName: string | null, dirty: boolean): Promise<void> {
  const db = await getDb();
  await db.put(
    "current",
    {
      json: serializeTDGFile(file),
      fileName,
      dirty,
      updated: new Date().toISOString(),
    },
    "draft",
  );
}

export async function loadDraft(): Promise<{ file: TDGFile; fileName: string | null; dirty: boolean } | null> {
  const db = await getDb();
  const record = await db.get("current", "draft");
  if (!record) return null;
  return {
    file: parseTDGFileText(record.json),
    fileName: record.fileName,
    dirty: record.dirty,
  };
}

export async function clearDraft(): Promise<void> {
  const db = await getDb();
  await db.delete("current", "draft");
}

export async function rememberRecent(file: TDGFile, fileName: string | null): Promise<void> {
  if (!isScenario(file.content)) return;
  const db = await getDb();
  const record: RecentRecord = {
    id: file.content.id,
    title: file.content.title,
    fileName,
    modified: file.modified,
    json: serializeTDGFile(file),
  };
  await db.put("recent", record);
  const all = await db.getAll("recent");
  all.sort((a, b) => b.modified.localeCompare(a.modified));
  const extra = all.slice(MAX_RECENT);
  for (const item of extra) {
    await db.delete("recent", item.id);
  }
}

export async function listRecent(): Promise<RecentRecord[]> {
  const db = await getDb();
  const all = await db.getAll("recent");
  return all.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function loadRecent(id: string): Promise<TDGFile | null> {
  const db = await getDb();
  const record = await db.get("recent", id);
  return record ? parseTDGFileText(record.json) : null;
}
