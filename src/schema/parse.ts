import { KNOWN_TDG_FILE_KEYS } from "./constants";
import { migrate } from "./migrate";
import type { TDGFile } from "./types";
import { tdgFileBodySchema } from "./zod";

function extractUnknownKeys(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const unknownKeys: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(KNOWN_TDG_FILE_KEYS as readonly string[]).includes(key)) {
      unknownKeys[key] = value;
    }
  }
  return Object.keys(unknownKeys).length > 0 ? unknownKeys : undefined;
}

export function parseTDGFile(raw: unknown): TDGFile {
  const migrated = migrate(raw);
  if (migrated === null || typeof migrated !== "object" || Array.isArray(migrated)) {
    throw new Error("TDG file must be a JSON object");
  }
  const record = migrated as Record<string, unknown>;
  const body = tdgFileBodySchema.parse(record);
  const unknownKeys = extractUnknownKeys(record);
  const file = body as TDGFile;
  return unknownKeys ? { ...file, unknownKeys } : file;
}

export function parseTDGFileText(text: string): TDGFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("File is not valid JSON");
  }
  return parseTDGFile(raw);
}

export function serializeTDGFile(file: TDGFile): string {
  const { unknownKeys, ...rest } = file;
  const out: Record<string, unknown> = {
    schemaVersion: rest.schemaVersion,
    fileType: rest.fileType,
    generator: rest.generator,
    created: rest.created,
    modified: rest.modified,
    content: rest.content,
  };
  if (rest.assets && Object.keys(rest.assets).length > 0) {
    out.assets = rest.assets;
  }
  if (unknownKeys) {
    for (const [key, value] of Object.entries(unknownKeys)) {
      if (!(key in out)) {
        out[key] = value;
      }
    }
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}
