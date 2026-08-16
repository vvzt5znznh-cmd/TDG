import { describe, expect, it } from "vitest";
import { pickFeature, pickVertex } from "./hitTest";
import { rotateHandlePoint, translateFeature } from "./geometry";
import type { MapFeature } from "../schema/types";

const road: MapFeature = {
  featureType: "terrain",
  id: "road",
  kind: "road",
  geometry: { type: "LineString", coordinates: [[0, 0], [100, 0]] },
  label: "MSR",
};

const swamp: MapFeature = {
  featureType: "terrain",
  id: "swamp",
  kind: "wetland",
  geometry: { type: "Polygon", coordinates: [[[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]]] },
  label: "Myr",
};

const unit: MapFeature = {
  featureType: "symbol",
  id: "plt",
  affiliation: "friendly",
  frame: "rectangle",
  confidence: "confirmed",
  position: { type: "Point", coordinates: [200, 200] },
  sizePx: 40,
};

describe("hit testing", () => {
  it("picks a line near a segment", () => {
    expect(pickFeature([road, swamp], [50, 4])?.id).toBe("road");
  });

  it("picks a polygon when clicking inside", () => {
    expect(pickFeature([road, swamp], [20, 20])?.id).toBe("swamp");
  });

  it("picks a symbol within its size", () => {
    expect(pickFeature([unit, road], [210, 205])?.id).toBe("plt");
  });

  it("picks a vertex on a polygon", () => {
    expect(pickVertex(swamp, [40, 0], 8)).toBe(1);
  });
});

describe("translateFeature", () => {
  it("moves a symbol position", () => {
    const moved = translateFeature(unit, 10, -5);
    if (moved.featureType !== "symbol") throw new Error("symbol");
    expect(moved.position.coordinates[0]).toBe(210);
    expect(moved.position.coordinates[1]).toBe(195);
  });

  it("moves every vertex of a line", () => {
    const moved = translateFeature(road, 5, 5);
    if (moved.featureType !== "terrain") throw new Error("terrain");
    expect(moved.geometry).toEqual({ type: "LineString", coordinates: [[5, 5], [105, 5]] });
  });
});

describe("rotate handle", () => {
  it("sits above the symbol at 0° and follows rotation", () => {
    expect(rotateHandlePoint(100, 100, 0, 50)).toEqual([100, 50]);
    const [x, y] = rotateHandlePoint(100, 100, 90, 50);
    expect(x).toBeCloseTo(150);
    expect(y).toBeCloseTo(100);
  });
});
