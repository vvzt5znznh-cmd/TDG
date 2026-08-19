import type { GeoGeometry, MapFeature } from "../schema/types";
import { dist2, distToSegment, editableVertices, pointInRing, pointsOf } from "./geometry";

export function featureHitDistance(feature: MapFeature, point: [number, number]): number {
  if (feature.featureType === "symbol") {
    const [x, y] = feature.position.coordinates;
    return Math.sqrt(dist2(point, [x, y]));
  }
  if (feature.featureType === "control_measure") {
    const verts = editableVertices(feature.geometry);
    if (verts.length >= 3 && pointInRing(point, verts)) return 0;
    return geometryHitDistance(feature.geometry, point);
  }
  return geometryHitDistance(feature.geometry, point);
}

function geometryHitDistance(geometry: GeoGeometry, point: [number, number]): number {
  if (geometry.type === "Point") {
    const [x, y] = geometry.coordinates;
    return Math.sqrt(dist2(point, [x, y]));
  }
  if (geometry.type === "LineString") {
    const pts = pointsOf(geometry);
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      best = Math.min(best, distToSegment(point, a, b));
    }
    return best;
  }
  const ring = editableVertices(geometry);
  if (pointInRing(point, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    best = Math.min(best, distToSegment(point, a, b));
  }
  return best;
}

export function pickFeature(features: MapFeature[], point: [number, number], threshold = 18): MapFeature | null {
  let best: MapFeature | null = null;
  let bestDist = Infinity;
  let bestRank = -1;
  let bestArea = Infinity;
  for (const feature of features) {
    const dist = featureHitDistance(feature, point);
    const limit =
      feature.featureType === "symbol"
        ? Math.max(threshold, (feature.sizePx ?? 42) * 0.7)
        : feature.featureType === "control_measure"
          ? Math.max(threshold, 22)
          : feature.featureType === "terrain" && feature.geometry.type === "LineString"
            ? Math.max(threshold, 24)
            : threshold;
    if (dist > limit) continue;
    const rank = feature.featureType === "symbol" ? 3 : feature.featureType === "control_measure" ? 2 : 1;
    const area = featureArea(feature);
    const closer = dist < bestDist - 0.4;
    const sameDistSmaller = Math.abs(dist - bestDist) <= 0.4 && area < bestArea;
    if (rank > bestRank || (rank === bestRank && (closer || sameDistSmaller))) {
      best = feature;
      bestDist = dist;
      bestRank = rank;
      bestArea = area;
    }
  }
  return best;
}

function featureArea(feature: MapFeature): number {
  if (feature.featureType === "symbol") {
    const size = feature.sizePx ?? 42;
    return size * size;
  }
  if (feature.featureType === "control_measure") {
    const verts = editableVertices(feature.geometry);
    if (verts.length < 2) return 1;
    const xs = verts.map((v) => v[0]);
    const ys = verts.map((v) => v[1]);
    return Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
  }
  const verts = "geometry" in feature ? editableVertices(feature.geometry) : [];
  if (verts.length < 2) return 1;
  const xs = verts.map((v) => v[0]);
  const ys = verts.map((v) => v[1]);
  return Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
}

export function pickVertex(feature: MapFeature, point: [number, number], threshold = 12): number | null {
  if (feature.featureType === "symbol") return null;
  const verts = editableVertices(feature.geometry);
  let best: number | null = null;
  let bestDist = threshold;
  verts.forEach((vert, index) => {
    const dist = Math.sqrt(dist2(point, vert));
    if (dist <= bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}
