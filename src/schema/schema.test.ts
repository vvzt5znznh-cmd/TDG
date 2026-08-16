import { describe, expect, it } from "vitest";
import { APP_NAME, SCHEMA_VERSION } from "./constants";
import { createNewFile } from "./create";
import { migrate } from "./migrate";
import { parseTDGFile, parseTDGFileText, serializeTDGFile } from "./parse";
import { buildOutcomeStates, isTimeExpiredOutcome, MISSION_TYPE_LABELS } from "./presets";
import type { MissionType } from "./types";

const MISSION_TYPES = Object.keys(MISSION_TYPE_LABELS) as MissionType[];

describe("parse and serialize", () => {
  it("round-trips a newly created file", () => {
    const file = createNewFile({ title: "Round trip" });
    const text = serializeTDGFile(file);
    const parsed = parseTDGFileText(text);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.fileType).toBe("scenario");
    expect(parsed.generator.app).toBe(APP_NAME);
    expect(parsed.content).toEqual(file.content);
    expect(parsed.assets).toEqual(file.assets);
  });

  it("preserves unknown top-level keys", () => {
    const file = createNewFile({ title: "Extras" });
    const text = serializeTDGFile({
      ...file,
      unknownKeys: {
        experimentalFlag: true,
        customProvenance: { source: "field notebook", year: 2026 },
      },
    });
    expect(text).toContain("experimentalFlag");
    expect(text).not.toContain("unknownKeys");
    const parsed = parseTDGFileText(text);
    expect(parsed.unknownKeys).toEqual({
      experimentalFlag: true,
      customProvenance: { source: "field notebook", year: 2026 },
    });
    const again = serializeTDGFile(parsed);
    const reparsed = parseTDGFileText(again);
    expect(reparsed.unknownKeys).toEqual(parsed.unknownKeys);
  });

  it("preserves an embedded raster asset", () => {
    const file = createNewFile();
    const imageRef =
      "dilemma" in file.content && file.content.maps[0]?.base.kind === "raster"
        ? file.content.maps[0].base.imageRef
        : "";
    expect(file.assets?.[imageRef]?.startsWith("data:image/")).toBe(true);
    const parsed = parseTDGFileText(serializeTDGFile(file));
    expect(parsed.assets?.[imageRef]).toBe(file.assets?.[imageRef]);
  });

  it("rejects non-objects", () => {
    expect(() => parseTDGFile([])).toThrow(/JSON object/);
    expect(() => parseTDGFileText("{")).toThrow(/not valid JSON/);
  });
});

describe("migrate", () => {
  it("is identity for 1.x", () => {
    const file = createNewFile();
    const raw = { ...JSON.parse(serializeTDGFile(file)), schemaVersion: "1.4.2" };
    const migrated = migrate(raw) as { schemaVersion: string };
    expect(migrated.schemaVersion).toBe("1.4.2");
    expect(migrated).toMatchObject({ fileType: "scenario" });
  });

  it("defaults a missing version to 1.0.0", () => {
    const file = JSON.parse(serializeTDGFile(createNewFile())) as Record<string, unknown>;
    delete file.schemaVersion;
    const migrated = migrate(file) as { schemaVersion: string };
    expect(migrated.schemaVersion).toBe("1.0.0");
  });

  it("passes through newer major versions without dropping fields", () => {
    const migrated = migrate({
      schemaVersion: "3.0.0",
      fileType: "scenario",
      futureOnly: { graph: true },
    }) as Record<string, unknown>;
    expect(migrated.futureOnly).toEqual({ graph: true });
  });
});

describe("mission-type presets", () => {
  it.each(MISSION_TYPES)("%s includes listed outcomes plus time-expired", (missionType) => {
    const states = buildOutcomeStates(missionType);
    expect(states.length).toBeGreaterThanOrEqual(3);
    expect(states.filter(isTimeExpiredOutcome)).toHaveLength(1);
    expect(states.at(-1)?.kind).toBe("time_expired");
  });
});
