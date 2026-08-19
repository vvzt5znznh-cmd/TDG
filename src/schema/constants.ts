export const APP_NAME = "TDG Builder";
export const APP_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

export const TIME_EXPIRED_LABEL = "No decision reached within time limit";
export const TIME_EXPIRED_DESCRIPTION =
  "The player does not issue a timely decision. The situation continues to develop against the default enemy timeline.";

export const KNOWN_TDG_FILE_KEYS = [
  "schemaVersion",
  "fileType",
  "generator",
  "created",
  "modified",
  "content",
  "assets",
] as const;
