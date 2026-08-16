import { newId } from "../schema/ids";
import type { Layer, MapDocument, MapFeature, TerrainFeature } from "../schema/types";

export function paperBackgroundSvg(title = ""): string {
  const heading = title
    ? `<text x="80" y="70" font-family="Georgia, serif" font-size="28" fill="#3d4a32">${escapeXml(title)}</text>`
    : "";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <rect width="1600" height="1200" fill="#e7e2d1"/>
  <rect x="24" y="24" width="1552" height="1152" fill="#efe9d6" stroke="#3d4a32" stroke-width="4"/>
  ${heading}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mapImageRef(map: MapDocument): string | undefined {
  if (map.underlay?.imageRef) return map.underlay.imageRef;
  if (map.base.kind === "raster") return map.base.imageRef;
  return undefined;
}

function overlayTerrain(map: MapDocument): TerrainFeature[] {
  const layer = map.layers.find((item) => item.role === "terrain");
  return (layer?.features.filter((feature) => feature.featureType === "terrain") ?? []) as TerrainFeature[];
}

export function ensureVectorBase(map: MapDocument): MapDocument {
  const fromOverlay = overlayTerrain(map);
  const stripTerrain = (layers: Layer[]): Layer[] =>
    layers.map((layer) =>
      layer.role === "terrain"
        ? { ...layer, features: layer.features.filter((feature) => feature.featureType !== "terrain") }
        : layer,
    );

  if (map.base.kind === "vector") {
    if (fromOverlay.length === 0) return map;
    return {
      ...map,
      base: { kind: "vector", features: [...map.base.features, ...fromOverlay] },
      layers: stripTerrain(map.layers),
    };
  }

  return {
    ...map,
    underlay: map.underlay ?? { imageRef: map.base.imageRef, opacity: map.base.opacity },
    base: { kind: "vector", features: fromOverlay },
    layers: stripTerrain(map.layers),
  };
}

export function baseFeatures(map: MapDocument): TerrainFeature[] {
  return map.base.kind === "vector" ? map.base.features : [];
}

export function allGroundAndOverlayFeatures(map: MapDocument): MapFeature[] {
  return [...baseFeatures(map), ...map.layers.flatMap((layer) => layer.features)];
}

export function addBaseTerrain(map: MapDocument, feature: TerrainFeature): MapDocument {
  const vector = ensureVectorBase(map);
  if (vector.base.kind !== "vector") return vector;
  return { ...vector, base: { kind: "vector", features: [...vector.base.features, feature] } };
}

export function deleteFeature(map: MapDocument, id: string): MapDocument {
  const vector = ensureVectorBase(map);
  return {
    ...vector,
    base:
      vector.base.kind === "vector"
        ? { kind: "vector", features: vector.base.features.filter((feature) => feature.id !== id) }
        : vector.base,
    layers: vector.layers.map((layer) => ({
      ...layer,
      features: layer.features.filter((feature) => feature.id !== id),
    })),
  };
}

export function patchFeature(map: MapDocument, id: string, patch: object): MapDocument {
  const vector = ensureVectorBase(map);
  return {
    ...vector,
    base:
      vector.base.kind === "vector"
        ? {
            kind: "vector",
            features: vector.base.features.map((feature) =>
              feature.id === id ? ({ ...feature, ...patch } as TerrainFeature) : feature,
            ),
          }
        : vector.base,
    layers: vector.layers.map((layer) => ({
      ...layer,
      features: layer.features.map((feature) => (feature.id === id ? ({ ...feature, ...patch } as MapFeature) : feature)),
    })),
  };
}

export function syntheticBaseLayer(map: MapDocument): Layer {
  return {
    id: map.id + "-base",
    role: "terrain",
    visibleIn: ["student", "facilitator"],
    features: baseFeatures(map),
  };
}

export function newTerrainId(): string {
  return `feat_${newId()}`;
}
