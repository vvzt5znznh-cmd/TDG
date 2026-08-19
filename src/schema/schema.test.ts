import { describe, expect, it } from "vitest";
import { mapImageRef } from "../map/mapBase";
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

  it("round-trips optional terrain paint and control-measure affiliation", () => {
    const file = createNewFile({ title: "Paint" });
    if (!("dilemma" in file.content)) throw new Error("expected scenario");
    const map = file.content.maps[0]!;
    if (map.base.kind !== "vector") throw new Error("vector");
    map.base.features.push({
      featureType: "terrain",
      id: "hill_1",
      kind: "mountain",
      geometry: { type: "Polygon", coordinates: [[[10, 10], [80, 10], [80, 80], [10, 80], [10, 10]]] },
      stroke: "#aa7744",
      contourCount: 5,
      contourInterval: 100,
      elevation: 400,
    });
    const layer = map.layers.find((item) => item.role === "control_measures");
    layer?.features.push({
      featureType: "control_measure",
      id: "seize_1",
      kind: "seize",
      geometry: { type: "LineString", coordinates: [[20, 20], [60, 20], [40, 80]] },
      label: "OBJ A",
      affiliation: "hostile",
      axisWidth: 42,
    });
    const parsed = parseTDGFileText(serializeTDGFile(file));
    if (!("dilemma" in parsed.content)) throw new Error("expected scenario");
    const next = parsed.content.maps[0]!;
    if (next.base.kind !== "vector") throw new Error("vector");
    const hill = next.base.features[0];
    expect(hill).toMatchObject({ stroke: "#aa7744", contourCount: 5, contourInterval: 100, elevation: 400 });
    const cm = next.layers.find((item) => item.role === "control_measures")?.features[0];
    expect(cm).toMatchObject({ kind: "seize", affiliation: "hostile", axisWidth: 42 });
  });

  it("creates a vector base with a paper underlay asset", () => {
    const file = createNewFile();
    if (!("dilemma" in file.content)) throw new Error("expected scenario");
    const map = file.content.maps[0];
    expect(map?.underlay?.imageRef).toBeTruthy();
    expect(map?.base.kind).toBe("vector");
    const imageRef = map ? mapImageRef(map) ?? "" : "";
    expect(file.assets?.[imageRef]?.startsWith("data:image/")).toBe(true);
    const parsed = parseTDGFileText(serializeTDGFile(file));
    expect(parsed.assets?.[imageRef]).toBe(file.assets?.[imageRef]);
  });

  it("round-trips a framed-map underlay source", () => {
    const file = createNewFile({ title: "Framed" });
    if (!("dilemma" in file.content)) throw new Error("expected scenario");
    const map = file.content.maps[0]!;
    map.underlay = {
      imageRef: map.underlay?.imageRef ?? "img_1",
      opacity: 1,
      source: {
        kind: "tiles",
        layerId: "topo",
        bounds: { west: 11.1, south: 60.3, east: 11.4, north: 60.55 },
        center: [60.42, 11.25],
        zoom: 12,
      },
    };
    const parsed = parseTDGFileText(serializeTDGFile(file));
    if (!("dilemma" in parsed.content)) throw new Error("expected scenario");
    expect(parsed.content.maps[0]?.underlay?.source).toEqual(map.underlay.source);
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

  it("lifts a trailing axis width point into axisWidth", () => {
    const migrated = migrate({
      schemaVersion: "1.0.0",
      content: {
        maps: [
          {
            layers: [
              {
                features: [
                  {
                    featureType: "control_measure",
                    kind: "axis_of_advance",
                    geometry: { type: "LineString", coordinates: [[380, 250], [550, 820], [380, 210]] },
                    label: "AXIS MAIN",
                  },
                ],
              },
            ],
          },
        ],
      },
    }) as {
      content: {
        maps: { layers: { features: { geometry: { coordinates: [number, number][] }; axisWidth: number }[] }[] }[];
      };
    };
    const feature = migrated.content.maps[0]!.layers[0]!.features[0]!;
    expect(feature.geometry.coordinates).toEqual([
      [380, 250],
      [550, 820],
    ]);
    expect(feature.axisWidth).toBeGreaterThan(5);
    expect(feature.axisWidth).toBeLessThan(80);
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
