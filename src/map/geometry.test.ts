import { describe, expect, it } from "vitest";
import {
  addPointOnLongestEdge,
  distToRect,
  insertVertex,
  nestedRings,
  removeVertex,
  rotateGeometry,
  rotateHandleFromBbox,
  rotateHandlePoint,
} from "./geometry";
import type { GeoGeometry } from "../schema/types";

describe("rotateGeometry", () => {
  it("rotates a line 90° clockwise about its center without changing length", () => {
    const geometry: GeoGeometry = { type: "LineString", coordinates: [[0, 0], [100, 0]] };
    const rotated = rotateGeometry(geometry, 90, [50, 0]);
    expect(rotated.type).toBe("LineString");
    if (rotated.type !== "LineString") throw new Error("line");
    expect(rotated.coordinates[0]![0]).toBeCloseTo(50);
    expect(rotated.coordinates[0]![1]).toBeCloseTo(-50);
    expect(rotated.coordinates[1]![0]).toBeCloseTo(50);
    expect(rotated.coordinates[1]![1]).toBeCloseTo(50);
  });
});

describe("insertVertex", () => {
  it("inserts a point on a line after the given edge", () => {
    const geometry: GeoGeometry = { type: "LineString", coordinates: [[0, 0], [100, 0]] };
    const next = insertVertex(geometry, 0, [50, 10]);
    expect(next).toEqual({ type: "LineString", coordinates: [[0, 0], [50, 10], [100, 0]] });
  });

  it("adds a midpoint on the longest edge", () => {
    const geometry: GeoGeometry = { type: "LineString", coordinates: [[0, 0], [10, 0], [100, 0]] };
    const next = addPointOnLongestEdge(geometry);
    expect(next.type).toBe("LineString");
    if (next.type !== "LineString") throw new Error("line");
    expect(next.coordinates).toHaveLength(4);
    expect(next.coordinates[2]).toEqual([55, 0]);
  });

  it("removes a line vertex but not below two points", () => {
    const geometry: GeoGeometry = { type: "LineString", coordinates: [[0, 0], [50, 0], [100, 0]] };
    const next = removeVertex(geometry, 1);
    expect(next).toEqual({ type: "LineString", coordinates: [[0, 0], [100, 0]] });
    expect(removeVertex(next, 0)).toEqual(next);
  });
});

describe("nestedRings", () => {
  it("makes the requested number of inner contour rings", () => {
    const square: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const rings = nestedRings(square, 2);
    expect(rings).toHaveLength(2);
    expect(rings[0]![0]![0]).toBeGreaterThan(0);
    expect(rings[0]![0]![0]).toBeLessThan(rings[1]![0]![0]);
  });
});

describe("distToRect", () => {
  it("is zero inside and positive outside", () => {
    expect(distToRect([5, 5], 0, 0, 10, 10)).toBe(0);
    expect(distToRect([20, 5], 0, 0, 10, 10)).toBe(10);
  });
});

describe("rotate handle from bbox", () => {
  it("sits above the top-center of the box at 0°", () => {
    const { anchor, handle } = rotateHandleFromBbox({ x: 0, y: 0, width: 100, height: 40 }, 0, 20);
    expect(anchor).toEqual([50, 0]);
    expect(handle).toEqual([50, -20]);
    expect(rotateHandlePoint(50, 0, 0, 20)).toEqual([50, -20]);
  });
});
