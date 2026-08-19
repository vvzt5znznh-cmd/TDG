/**
 * Additive-only migration harness.
 * v1.x files are identity except for field backfills that older writers
 * could not have stored. Unknown future versions keep extra fields and
 * parse the known subset. Never remove or repurpose a field here.
 */

const AXIS_KINDS = new Set(["axis_of_advance", "axis_supporting", "axis_aviation"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function vertsOf(geometry: unknown): [number, number][] {
  if (!isRecord(geometry)) return [];
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    return [[Number(geometry.coordinates[0]), Number(geometry.coordinates[1])]];
  }
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .filter((coord): coord is [number, number] => Array.isArray(coord) && coord.length >= 2)
      .map((coord) => [Number(coord[0]), Number(coord[1])]);
  }
  return [];
}

/** Perpendicular distance from `point` to the first shaft segment. */
function perpDistanceToFirstSegment(shaft: [number, number][], point: [number, number]): number {
  const a = shaft[0];
  const b = shaft[1] ?? shaft[0];
  if (!a || !b) return 50;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return Math.abs((point[0] - a[0]) * nx + (point[1] - a[1]) * ny);
}

function migrateAxisFeature(feature: Record<string, unknown>): Record<string, unknown> {
  if (feature.featureType !== "control_measure") return feature;
  if (typeof feature.kind !== "string" || !AXIS_KINDS.has(feature.kind)) return feature;
  if (typeof feature.axisWidth === "number" && Number.isFinite(feature.axisWidth)) return feature;
  const verts = vertsOf(feature.geometry);
  if (verts.length < 3) return feature;
  const widthPt = verts[verts.length - 1]!;
  const shaft = verts.slice(0, -1);
  return {
    ...feature,
    axisWidth: perpDistanceToFirstSegment(shaft, widthPt),
    geometry: { type: "LineString", coordinates: shaft },
  };
}

function migrateLayer(layer: unknown): unknown {
  if (!isRecord(layer) || !Array.isArray(layer.features)) return layer;
  return { ...layer, features: layer.features.map((feature) => (isRecord(feature) ? migrateAxisFeature(feature) : feature)) };
}

function migrateMap(map: unknown): unknown {
  if (!isRecord(map) || !Array.isArray(map.layers)) return map;
  return { ...map, layers: map.layers.map(migrateLayer) };
}

function migrateContent(content: unknown): unknown {
  if (!isRecord(content) || !Array.isArray(content.maps)) return content;
  return { ...content, maps: content.maps.map(migrateMap) };
}

export function migrate(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const file = raw as Record<string, unknown>;
  const version = typeof file.schemaVersion === "string" ? file.schemaVersion : "1.0.0";
  const major = Number.parseInt(version.split(".")[0] ?? "1", 10);

  const withAxis = { ...file, content: migrateContent(file.content) };

  switch (major) {
    case 1:
      return { ...withAxis, schemaVersion: file.schemaVersion ?? "1.0.0" };
    default:
      // Additive-only: a newer file should still open; unknown keys are preserved elsewhere.
      return withAxis;
  }
}
