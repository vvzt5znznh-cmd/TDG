import { describe, expect, it } from "vitest";
import { createMapDocument } from "../schema/create";
import { addBaseTerrain, ensureLayer, ensureVectorBase, isRasterUnderlay, mapImageRef, paperBackgroundSvg } from "./mapBase";
import { setVertex } from "./geometry";

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
