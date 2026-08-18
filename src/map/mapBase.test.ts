import { describe, expect, it } from "vitest";
import { createMapDocument } from "../schema/create";
import { addBaseTerrain, ensureLayer, ensureVectorBase, isRasterUnderlay, mapImageRef, paperBackgroundSvg } from "./mapBase";
import { scaleGeometry, setVertex, smoothPath } from "./geometry";

describe("editable map base", () => {
  it("promotes a raster base to vector + underlay", () => {
    const map = createMapDocument("img_1");
    map.layers[0] = {
      ...map.layers[0]!,
      role: "terrain",
      features: [
        {
          featureType: "terrain",
          id: "swamp",
          kind: "wetland",
          geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
          label: "Myr",
        },
      ],
    };
    // createMapDocument now starts vector; simulate a legacy raster file:
    const legacy = { ...map, base: { kind: "raster" as const, imageRef: "img_1", opacity: 1 } };
    const promoted = ensureVectorBase(legacy);
    expect(promoted.base.kind).toBe("vector");
    if (promoted.base.kind !== "vector") throw new Error("expected vector");
    expect(promoted.underlay?.imageRef).toBe("img_1");
    expect(promoted.base.features).toHaveLength(1);
    expect(promoted.layers.find((layer) => layer.role === "terrain")?.features).toEqual([]);
  });

  it("adds ground to the vector base", () => {
    const map = createMapDocument("img_1");
    const next = addBaseTerrain(map, {
      featureType: "terrain",
      id: "road",
      kind: "road",
      geometry: { type: "LineString", coordinates: [[0, 0], [10, 10]] },
      label: "MSR",
    });
    expect(next.base.kind).toBe("vector");
    if (next.base.kind !== "vector") throw new Error("expected vector");
    expect(next.base.features[0]?.label).toBe("MSR");
  });

  it("moves a polygon vertex and keeps the ring closed", () => {
    const moved = setVertex(
      { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
      0,
      [2, 3],
    );
    expect(moved.type).toBe("Polygon");
    if (moved.type !== "Polygon") throw new Error("poly");
    expect(moved.coordinates[0]?.[0]).toEqual([2, 3]);
    expect(moved.coordinates[0]?.at(-1)).toEqual([2, 3]);
  });

  it("treats generated paper SVG as non-raster so print does not nest SVG-in-SVG", () => {
    expect(paperBackgroundSvg("Test")).toContain("Test");
    expect(paperBackgroundSvg()).not.toContain("Schematic");
    expect(isRasterUnderlay(paperBackgroundSvg("Korsmyr"))).toBe(false);
    expect(isRasterUnderlay("data:image/png;base64,aaa")).toBe(true);
    expect(isRasterUnderlay("data:image/jpeg;base64,aaa")).toBe(true);
    expect(isRasterUnderlay("https://example.test/trace.jpg")).toBe(true);
    expect(isRasterUnderlay("https://example.test/sheet.svg")).toBe(false);
    expect(isRasterUnderlay(undefined)).toBe(false);
  });

  it("resolves the tracing image from underlay on a vector map", () => {
    const map = createMapDocument("img_paper");
    expect(map.base.kind).toBe("vector");
    expect(mapImageRef(map)).toBe("img_paper");
  });

  it("plans real-map tiles that cover the sheet at a sane zoom", async () => {
    const { groundWidthMeters, scaleBarMeters, tilePlan } = await import("./realmap");
    const bounds = { west: 11.0, south: 60.3, east: 11.3, north: 60.5 };
    const tiles = tilePlan(bounds);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(130);
    const z = tiles[0]!.z;
    expect(tiles.every((tile) => tile.z === z)).toBe(true);
    // Tiles must blanket the sheet: leftmost tile starts at or before x=0.
    expect(Math.min(...tiles.map((t) => t.px))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.px + t.size))).toBeGreaterThanOrEqual(1600);
    // ~0.3° of longitude at 60°N is ~16.7 km; the scale bar rounds to 1/2/5.
    const width = groundWidthMeters(bounds);
    expect(width).toBeGreaterThan(15000);
    expect(width).toBeLessThan(18000);
    expect([1000, 2000]).toContain(scaleBarMeters(width));
  });

  it("smooths clicked points into a curve and keeps closed rings closed", () => {
    const open = smoothPath([[0, 0], [100, 40], [200, 0]]);
    expect(open.startsWith("M 0 0 C")).toBe(true);
    expect(open).not.toContain("Z");
    const closed = smoothPath([[0, 0], [100, 0], [100, 100], [0, 100]], true);
    expect(closed.endsWith("Z")).toBe(true);
    expect(smoothPath([[0, 0], [50, 50]])).toBe("M 0 0 L 50 50");
  });

  it("scales control points about a fixed center", () => {
    const scaled = scaleGeometry({ type: "LineString", coordinates: [[100, 100], [200, 100]] }, 2, [100, 100]);
    expect(scaled).toEqual({ type: "LineString", coordinates: [[100, 100], [300, 100]] });
  });

  it("accepts the new terrain kinds in the file schema", async () => {
    const { mapFeatureSchema } = await import("../schema/zod");
    for (const kind of ["mountain", "river", "stream", "building"]) {
      const parsed = mapFeatureSchema.safeParse({
        featureType: "terrain",
        id: `t_${kind}`,
        kind,
        geometry:
          kind === "mountain"
            ? { type: "Polygon", coordinates: [[[0, 0], [100, 0], [60, 80], [0, 0]]] }
            : { type: "LineString", coordinates: [[0, 0], [200, 40]] },
      });
      expect(parsed.success, kind).toBe(true);
    }
  });

  it("adds a missing identity overlay on old maps", () => {
    const map = createMapDocument("img_1");
    map.layers = map.layers.filter((layer) => layer.role !== "neutral" && layer.role !== "unknown");
    expect(map.layers.some((layer) => layer.role === "neutral")).toBe(false);
    const withNeutral = ensureLayer(map, "neutral");
    expect(withNeutral.layers.find((layer) => layer.role === "neutral")?.visibleIn).toEqual(["student", "facilitator"]);
    const withUnknown = ensureLayer(withNeutral, "unknown");
    expect(withUnknown.layers.find((layer) => layer.role === "unknown")?.visibleIn).toEqual(["student", "facilitator"]);
    expect(ensureLayer(withUnknown, "unknown")).toBe(withUnknown);
  });
});
