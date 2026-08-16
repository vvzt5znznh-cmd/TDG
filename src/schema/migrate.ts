/**
 * Additive-only migration harness.
 * v1.x files are identity. Unknown future versions keep extra fields and
 * parse the known subset. Never remove or repurpose a field here.
 */
export function migrate(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const file = raw as Record<string, unknown>;
  const version = typeof file.schemaVersion === "string" ? file.schemaVersion : "1.0.0";
  const major = Number.parseInt(version.split(".")[0] ?? "1", 10);

  switch (major) {
    case 1:
      return { ...file, schemaVersion: file.schemaVersion ?? "1.0.0" };
    default:
      // Additive-only: a newer file should still open; unknown keys are preserved elsewhere.
      return file;
  }
}
