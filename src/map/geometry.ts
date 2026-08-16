import type { GeoGeometry, Position } from "../schema/types";

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
