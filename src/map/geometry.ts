import type { GeoGeometry, MapFeature, Position } from "../schema/types";

export function pointsOf(geometry: GeoGeometry): [number, number][] {
  if (geometry.type === "Point") return [[geometry.coordinates[0], geometry.coordinates[1]]];
  if (geometry.type === "LineString") return geometry.coordinates.map(([x, y]) => [x, y]);
  return geometry.coordinates[0]?.map(([x, y]) => [x, y]) ?? [];
}

export function toSvgPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Vertices you can drag. Closed polygon rings hide the duplicate last point. */
export function editableVertices(geometry: GeoGeometry): [number, number][] {
  const pts = pointsOf(geometry);
  if (geometry.type === "Polygon" && pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first && last && first[0] === last[0] && first[1] === last[1]) return pts.slice(0, -1);
  }
  return pts;
}

export function setVertex(geometry: GeoGeometry, index: number, point: Position): GeoGeometry {
  if (geometry.type === "Point") {
    return { type: "Point", coordinates: point };
  }
  if (geometry.type === "LineString") {
    const coordinates = geometry.coordinates.map((coord, coordIndex) => (coordIndex === index ? point : coord));
    return { type: "LineString", coordinates };
  }
  const ring = [...(geometry.coordinates[0] ?? [])];
  if (!ring[index]) return geometry;
  ring[index] = point;
  if (ring.length > 1 && index === 0) ring[ring.length - 1] = point;
  if (ring.length > 1 && index === ring.length - 1) ring[0] = point;
  return { type: "Polygon", coordinates: [ring] };
}

export function translatePosition(point: Position, dx: number, dy: number): Position {
  return [point[0] + dx, point[1] + dy];
}

export function translateGeometry(geometry: GeoGeometry, dx: number, dy: number): GeoGeometry {
  if (geometry.type === "Point") {
    return { type: "Point", coordinates: translatePosition(geometry.coordinates, dx, dy) };
  }
  if (geometry.type === "LineString") {
    return { type: "LineString", coordinates: geometry.coordinates.map((coord) => translatePosition(coord, dx, dy)) };
  }
  return {
    type: "Polygon",
    coordinates: geometry.coordinates.map((ring) => ring.map((coord) => translatePosition(coord, dx, dy))),
  };
}

export function translateFeature(feature: MapFeature, dx: number, dy: number): MapFeature {
  if (feature.featureType === "symbol") {
    return {
      ...feature,
      position: { type: "Point", coordinates: translatePosition(feature.position.coordinates, dx, dy) },
    };
  }
  return { ...feature, geometry: translateGeometry(feature.geometry, dx, dy) } as MapFeature;
}

/** Scale a geometry's points about a fixed center (uniform warp of control points). */
export function scaleGeometry(geometry: GeoGeometry, factor: number, center: [number, number]): GeoGeometry {
  const scale = (pos: Position): Position => [center[0] + (pos[0] - center[0]) * factor, center[1] + (pos[1] - center[1]) * factor];
  if (geometry.type === "Point") return { type: "Point", coordinates: scale(geometry.coordinates) };
  if (geometry.type === "LineString") return { type: "LineString", coordinates: geometry.coordinates.map(scale) };
  return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => ring.map(scale)) };
}

export function geometryCentroid(geometry: GeoGeometry): [number, number] {
  return centroid(editableVertices(geometry));
}

export function snapPoint(point: [number, number], step: number): [number, number] {
  if (step <= 0) return point;
  return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

export function dist2(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

export function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.sqrt(dist2(p, a));
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function pointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const intersect = a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1] + 0.00001) + a[0];
    if (intersect) inside = !inside;
  }
  return inside;
}

export function centroid(pts: [number, number][]): [number, number] {
  if (pts.length === 0) return [0, 0];
  const sum = pts.reduce<[number, number]>((acc, pt) => [acc[0] + pt[0], acc[1] + pt[1]], [0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length];
}

export const ROTATE_HANDLE_DISTANCE = 56;

/** Handle sits above the symbol at 0°, then follows rotation. */
export function rotateHandlePoint(cx: number, cy: number, rotationDeg: number, distance = ROTATE_HANDLE_DISTANCE): [number, number] {
  const rad = (rotationDeg * Math.PI) / 180;
  return [cx + Math.sin(rad) * distance, cy - Math.cos(rad) * distance];
}

export function pointerDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
