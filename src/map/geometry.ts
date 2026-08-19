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

/**
 * Catmull-Rom spline through the points as an SVG path — a few clicks give the
 * organic hand-drawn curves of a TDG sheet instead of hard polylines.
 */
export function smoothPath(pts: [number, number][], closed = false): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]![0]} ${pts[0]![1]}`;
  if (pts.length === 2 && !closed) {
    return `M ${pts[0]![0]} ${pts[0]![1]} L ${pts[1]![0]} ${pts[1]![1]}`;
  }
  const n = pts.length;
  const at = (i: number): [number, number] => {
    if (closed) return pts[((i % n) + n) % n]!;
    return pts[Math.max(0, Math.min(n - 1, i))]!;
  };
  const round = (v: number) => Math.round(v * 10) / 10;
  let d = `M ${round(at(0)[0])} ${round(at(0)[1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${round(c1[0])} ${round(c1[1])}, ${round(c2[0])} ${round(c2[1])}, ${round(p2[0])} ${round(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** Scale a geometry's points about a fixed center (uniform warp of control points). */
export function scaleGeometry(geometry: GeoGeometry, factor: number, center: [number, number]): GeoGeometry {
  const scale = (pos: Position): Position => [center[0] + (pos[0] - center[0]) * factor, center[1] + (pos[1] - center[1]) * factor];
  if (geometry.type === "Point") return { type: "Point", coordinates: scale(geometry.coordinates) };
  if (geometry.type === "LineString") return { type: "LineString", coordinates: geometry.coordinates.map(scale) };
  return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => ring.map(scale)) };
}

/** Rotate a geometry's points about a center. Positive degrees are clockwise (paper y-down). */
export function rotateGeometry(geometry: GeoGeometry, deg: number, center: [number, number]): GeoGeometry {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (pos: Position): Position => {
    const dx = pos[0] - center[0];
    const dy = pos[1] - center[1];
    return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
  };
  if (geometry.type === "Point") return { type: "Point", coordinates: rot(geometry.coordinates) };
  if (geometry.type === "LineString") return { type: "LineString", coordinates: geometry.coordinates.map(rot) };
  return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => ring.map(rot)) };
}

/** Insert a vertex after `afterIndex` on a line or polygon ring. Points are unchanged. */
export function insertVertex(geometry: GeoGeometry, afterIndex: number, point: Position): GeoGeometry {
  if (geometry.type === "Point") return geometry;
  if (geometry.type === "LineString") {
    const coordinates = geometry.coordinates.slice();
    const index = Math.max(0, Math.min(coordinates.length, afterIndex + 1));
    coordinates.splice(index, 0, point);
    return { type: "LineString", coordinates };
  }
  const verts = editableVertices(geometry);
  if (verts.length === 0) return geometry;
  const index = Math.max(0, Math.min(verts.length, afterIndex + 1));
  verts.splice(index, 0, [point[0], point[1]]);
  const first = verts[0]!;
  return { type: "Polygon", coordinates: [[...verts, first]] };
}

export function longestEdgeIndex(pts: [number, number][], closed: boolean): number {
  if (pts.length < 2) return 0;
  const last = closed ? pts.length : pts.length - 1;
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < last; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const len = dist2(a, b);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  return best;
}

/** Midpoint of the longest edge — used by inspector “Add point”. */
export function addPointOnLongestEdge(geometry: GeoGeometry): GeoGeometry {
  const verts = editableVertices(geometry);
  if (verts.length < 2) return geometry;
  const closed = geometry.type === "Polygon";
  const edge = longestEdgeIndex(verts, closed);
  const a = verts[edge]!;
  const b = verts[(edge + 1) % verts.length]!;
  return insertVertex(geometry, edge, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
}

export function nearestEdge(pts: [number, number][], point: [number, number], closed: boolean): { index: number; dist: number; at: [number, number] } | null {
  if (pts.length < 2) return null;
  const last = closed ? pts.length : pts.length - 1;
  let best: { index: number; dist: number; at: [number, number] } | null = null;
  for (let i = 0; i < last; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const hit = projectOnSegment(point, a, b);
    if (!best || hit.dist < best.dist) best = { index: i, dist: hit.dist, at: hit.at };
  }
  return best;
}

function projectOnSegment(p: [number, number], a: [number, number], b: [number, number]): { dist: number; at: [number, number] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return { dist: Math.sqrt(dist2(p, a)), at: a };
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
  const at: [number, number] = [a[0] + t * dx, a[1] + t * dy];
  return { dist: Math.hypot(p[0] - at[0], p[1] - at[1]), at };
}

/** Nested contour rings for a hill. `count` is inner rings; factors step toward the peak. */
export function nestedRings(pts: [number, number][], count: number): [number, number][][] {
  if (count <= 0 || pts.length < 3) return [];
  const [cx, cy] = centroid(pts);
  const rings: [number, number][][] = [];
  for (let i = 1; i <= count; i++) {
    const factor = 1 - i / (count + 1);
    rings.push(pts.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]));
  }
  return rings;
}

export function distToRect(p: [number, number], x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x - p[0], 0, p[0] - (x + width));
  const dy = Math.max(y - p[1], 0, p[1] - (y + height));
  return Math.hypot(dx, dy);
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

export const ROTATE_HANDLE_DISTANCE = 28;

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointsBBox(pts: [number, number][]): BBox | null {
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Stem from the top-center of the box, then offset by rotation (0° is straight up). */
export function rotateHandleFromBbox(bbox: BBox, rotationDeg: number, stem = ROTATE_HANDLE_DISTANCE): {
  anchor: [number, number];
  handle: [number, number];
} {
  const anchor: [number, number] = [bbox.x + bbox.width / 2, bbox.y];
  return { anchor, handle: rotateHandlePoint(anchor[0], anchor[1], rotationDeg, stem) };
}

/** Uniform-scale grip: bottom-right of the box. */
export function scaleHandleFromBbox(bbox: BBox, offset = 18): [number, number] {
  return [bbox.x + bbox.width + offset, bbox.y + bbox.height + offset];
}

/** Handle sits above the point at 0°, then follows rotation. */
export function rotateHandlePoint(cx: number, cy: number, rotationDeg: number, distance = ROTATE_HANDLE_DISTANCE): [number, number] {
  const rad = (rotationDeg * Math.PI) / 180;
  return [cx + Math.sin(rad) * distance, cy - Math.cos(rad) * distance];
}

export function pointerDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
