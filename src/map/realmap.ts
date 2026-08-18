import { MAP_HEIGHT, MAP_WIDTH } from "./viewport";

/**
 * Web-mercator tile math for snapshotting a real-world extent onto the paper
 * sheet. The snapshot becomes a plain underlay raster inside the .tdg.json, so
 * files stay local-first and print exactly what the author framed.
 */

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
  /** Destination rectangle on the sheet canvas. */
  px: number;
  py: number;
  size: number;
}

const mercX = (lon: number) => (lon + 180) / 360;
const mercY = (lat: number) => {
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
};

/**
 * Tiles covering `bounds`, positioned for a MAP_WIDTH x MAP_HEIGHT canvas.
 * Picks the zoom whose native resolution best matches the sheet width so the
 * print stays sharp without downloading a tile pyramid.
 */
export function tilePlan(bounds: GeoBounds, maxZoom = 17): TileRef[] {
  const xw = mercX(bounds.west);
  const xe = mercX(bounds.east);
  const yn = mercY(bounds.north);
  const ys = mercY(bounds.south);
  const widthFrac = Math.max(1e-9, xe - xw);
  const heightFrac = Math.max(1e-9, ys - yn);
  const z = Math.max(1, Math.min(maxZoom, Math.round(Math.log2(MAP_WIDTH / (widthFrac * 256)))));
  const n = 2 ** z;
  const tiles: TileRef[] = [];
  const x0 = Math.floor(xw * n);
  const x1 = Math.floor(xe * n);
  const y0 = Math.floor(yn * n);
  const y1 = Math.floor(ys * n);
  const sizeX = MAP_WIDTH / (widthFrac * n);
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      tiles.push({
        z,
        x: ((tx % n) + n) % n,
        y: ty,
        px: (tx / n - xw) / widthFrac * MAP_WIDTH,
        py: (ty / n - yn) / heightFrac * MAP_HEIGHT,
        size: sizeX,
      });
    }
  }
  return tiles;
}

/** Ground distance in meters across the sheet width at the extent's mid latitude. */
export function groundWidthMeters(bounds: GeoBounds): number {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const dLon = ((bounds.east - bounds.west) * Math.PI) / 180;
  return 6371000 * dLon * Math.cos(midLat);
}

/** Round to a map-friendly 1/2/5 step. */
export function niceMeters(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const ratio = value / magnitude;
  const step = ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1;
  return step * magnitude;
}

/** Scale-bar meters for a bar of `barPx` on a sheet spanning `widthMeters`. */
export function scaleBarMeters(widthMeters: number, barPx = 160): number {
  return niceMeters((widthMeters * barPx) / MAP_WIDTH);
}

export interface TileLayerDef {
  id: string;
  label: string;
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
}

export const TILE_LAYERS: readonly TileLayerDef[] = [
  {
    id: "osm",
    label: "OpenStreetMap",
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  {
    id: "topo",
    label: "OpenTopoMap (contours)",
    urlTemplate: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)",
    maxZoom: 16,
  },
] as const;

export function tileUrl(layer: TileLayerDef, tile: TileRef): string {
  return layer.urlTemplate.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
}

/** Compose the extent's tiles onto a sheet-sized canvas. Resolves to a JPEG data URL. */
export async function snapshotExtent(layer: TileLayerDef, bounds: GeoBounds): Promise<string> {
  const tiles = tilePlan(bounds, layer.maxZoom);
  if (tiles.length === 0 || tiles.length > 130) {
    throw new Error("Zoom in a little — this extent needs too many map tiles.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#e7e2d1";
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  await Promise.all(
    tiles.map(
      (tile) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            ctx.drawImage(img, tile.px, tile.py, tile.size + 0.5, tile.size + 0.5);
            resolve();
          };
          img.onerror = () => reject(new Error("A map tile failed to load. Check the connection and try again."));
          img.src = tileUrl(layer, tile);
        }),
    ),
  );

  // Tile usage policies require visible attribution; bake it into the sheet.
  ctx.font = "16px sans-serif";
  const text = layer.attribution;
  const metrics = ctx.measureText(text);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(MAP_WIDTH - metrics.width - 24, MAP_HEIGHT - 30, metrics.width + 24, 30);
  ctx.fillStyle = "#1b2118";
  ctx.fillText(text, MAP_WIDTH - metrics.width - 12, MAP_HEIGHT - 10);

  return canvas.toDataURL("image/jpeg", 0.88);
}
