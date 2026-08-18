import type { ControlMeasure, ControlMeasureKind } from "../schema/types";
import { editableVertices } from "./geometry";
import { MAP_HEIGHT } from "./viewport";

/**
 * Adapter over the US Army MIL-STD-2525D/APP-6D renderer (mil-sym-ts).
 * The sheet is mapped onto a small pseudo-geo frame at 1000 px per degree so
 * the renderer's GeoSVG output lands back on paper coordinates unchanged.
 * Every graphic is reconstructed from its control points by the standard's
 * draw rules — stretching a graphic can never deform its symbol elements.
 */

type C5 = typeof import("@armyc2.c5isr.renderer/mil-sym-ts-web");

const PX_PER_DEGREE = 1000;
/** Rendering frame with margin so graphics near the sheet edge are not clipped. */
const FRAME = { west: -0.8, south: -0.8, east: 2.4, north: 2.0 };
const FRAME_BBOX = `${FRAME.west},${FRAME.south},${FRAME.east},${FRAME.north}`;
const FRAME_WIDTH = Math.round((FRAME.east - FRAME.west) * PX_PER_DEGREE);
const FRAME_HEIGHT = Math.round((FRAME.north - FRAME.south) * PX_PER_DEGREE);

let c5: C5 | null = null;
let readyPromise: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

export function ensureMilStd(): Promise<void> {
  if (!readyPromise) {
    readyPromise = import("@armyc2.c5isr.renderer/mil-sym-ts-web").then(async (mod) => {
      await mod.initialize();
      c5 = mod;
      for (const listener of readyListeners) listener();
    });
  }
  return readyPromise;
}

export function isMilStdReady(): boolean {
  return c5 != null;
}

/** Subscribe to the moment the renderer becomes usable. Returns unsubscribe. */
export function onMilStdReady(listener: () => void): () => void {
  if (c5) {
    listener();
    return () => {};
  }
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

export type GraphicGroup = "tasks-action" | "tasks-effect" | "tasks-security" | "measures";

export interface GraphicDef {
  kind: ControlMeasureKind;
  /** 2525D entity code (SIDC positions 11-16) in symbol set 25. */
  entity: string;
  label: string;
  group: GraphicGroup;
  /** How the author places it: click once, click a line of control points, or outline an area. */
  draw: "point" | "line" | "polygon";
  hint: string;
}

/**
 * Entity codes read from the renderer's own MIL-STD-2525D symbol table
 * (Control Measure symbol set 25), not transcribed from memory.
 */
export const GRAPHIC_DEFS: readonly GraphicDef[] = [
  { kind: "seize", entity: "342300", label: "Seize", group: "tasks-action", draw: "line", hint: "Take possession of the objective. Arrow from your force onto it." },
  { kind: "clear", entity: "340500", label: "Clear", group: "tasks-action", draw: "line", hint: "Remove all enemy in the area." },
  { kind: "breach", entity: "340200", label: "Breach", group: "tasks-action", draw: "line", hint: "Break through the obstacle." },
  { kind: "bypass", entity: "340300", label: "Bypass", group: "tasks-action", draw: "line", hint: "Go around; arms embrace what you avoid." },
  { kind: "canalize", entity: "340400", label: "Canalize", group: "tasks-action", draw: "line", hint: "Force the enemy into a narrow zone." },
  { kind: "penetrate", entity: "341800", label: "Penetrate", group: "tasks-action", draw: "line", hint: "Break through the enemy defense." },
  { kind: "turn", entity: "270504", label: "Turn", group: "tasks-action", draw: "line", hint: "Force the enemy from one approach to another." },
  { kind: "ambush", entity: "141700", label: "Ambush", group: "tasks-action", draw: "line", hint: "Attack by fire from a concealed position." },
  { kind: "occupy", entity: "341700", label: "Occupy", group: "tasks-action", draw: "line", hint: "Move into and control the area, unopposed." },
  { kind: "retain", entity: "151205", label: "Retain", group: "tasks-action", draw: "line", hint: "Keep the terrain against attack." },
  { kind: "secure", entity: "342100", label: "Secure", group: "tasks-action", draw: "line", hint: "Prevent enemy damage or destruction." },
  { kind: "block", entity: "340100", label: "Block", group: "tasks-effect", draw: "line", hint: "Deny the enemy an avenue of approach." },
  { kind: "fix", entity: "341100", label: "Fix", group: "tasks-effect", draw: "line", hint: "Keep the enemy from moving." },
  { kind: "disrupt", entity: "341000", label: "Disrupt", group: "tasks-effect", draw: "line", hint: "Break up the enemy's tempo and formation." },
  { kind: "destroy", entity: "340900", label: "Destroy", group: "tasks-effect", draw: "point", hint: "Render the enemy combat-ineffective." },
  { kind: "neutralize", entity: "341600", label: "Neutralize", group: "tasks-effect", draw: "point", hint: "Make the enemy incapable of interfering." },
  { kind: "contain", entity: "151204", label: "Contain", group: "tasks-effect", draw: "line", hint: "Stop and hold the enemy on a front." },
  { kind: "isolate", entity: "341500", label: "Isolate", group: "tasks-effect", draw: "line", hint: "Cut the enemy off from support." },
  { kind: "suppress", entity: "342800", label: "Suppress", group: "tasks-effect", draw: "point", hint: "Temporarily degrade the enemy." },
  { kind: "screen", entity: "342203", label: "Screen", group: "tasks-security", draw: "line", hint: "Observe and warn across the front." },
  { kind: "guard", entity: "342202", label: "Guard", group: "tasks-security", draw: "line", hint: "Protect the main body; fight to gain time." },
  { kind: "cover", entity: "342201", label: "Cover", group: "tasks-security", draw: "line", hint: "Fight forward, independent of the main body." },
  { kind: "support_by_fire", entity: "152100", label: "Support by fire", group: "tasks-security", draw: "line", hint: "Position that supports the maneuver force by direct fire." },
  { kind: "attack_by_fire", entity: "152000", label: "Attack by fire", group: "tasks-security", draw: "line", hint: "Engage without closing with the enemy." },
  { kind: "objective", entity: "151700", label: "Objective", group: "measures", draw: "polygon", hint: "Area to seize or hold." },
  { kind: "phase_line", entity: "140300", label: "Phase line", group: "measures", draw: "line", hint: "Line to control the operation's tempo." },
  { kind: "axis_of_advance", entity: "151404", label: "Axis of advance", group: "measures", draw: "line", hint: "Route arrow; last point sets the head width." },
  { kind: "boundary", entity: "110100", label: "Boundary", group: "measures", draw: "line", hint: "Limit between units." },
  { kind: "engagement_area", entity: "151300", label: "Engagement area", group: "measures", draw: "polygon", hint: "Area to mass fires on the enemy." },
  { kind: "battle_position", entity: "151200", label: "Battle position", group: "measures", draw: "polygon", hint: "Position a unit defends from." },
  { kind: "trp", entity: "160300", label: "TRP", group: "measures", draw: "point", hint: "Target reference point." },
  { kind: "checkpoint", entity: "130300", label: "Checkpoint", group: "measures", draw: "point", hint: "Point to control movement." },
  { kind: "lz", entity: "150800", label: "LZ", group: "measures", draw: "polygon", hint: "Landing zone area." },
] as const;

/** Pad drawn points up to the graphic's minimum so a sparse sketch still renders. */
export function padPoints(kind: ControlMeasureKind, points: [number, number][]): [number, number][] {
  const spec = pointSpec(kind);
  if (!spec || points.length === 0) return points;
  const out = [...points];
  let step = 1;
  while (out.length < spec.min) {
    const last = out[out.length - 1]!;
    out.push([last[0] + 50 * step, last[1] - 50]);
    step += 1;
  }
  if (out.length > spec.max) out.length = spec.max;
  return out;
}

const DEF_BY_KIND = new Map(GRAPHIC_DEFS.map((def) => [def.kind, def]));

export function graphicDef(kind: ControlMeasureKind): GraphicDef | undefined {
  return DEF_BY_KIND.get(kind);
}

export function sidcFor(kind: ControlMeasureKind): string | undefined {
  const def = DEF_BY_KIND.get(kind);
  return def ? `1003250000${def.entity}0000` : undefined;
}

export interface PointSpec {
  geometry: "Point" | "Line" | "Area";
  min: number;
  max: number;
}

export function pointSpec(kind: ControlMeasureKind): PointSpec | null {
  const def = DEF_BY_KIND.get(kind);
  if (!def || !c5) return null;
  const info = c5.MSLookup.getInstance().getMSLInfo(`25${def.entity}`, c5.SymbolID.Version_2525Dch1);
  if (!info) return null;
  const geometryRaw = (info.getGeometry() || "point").toLowerCase();
  const geometry: PointSpec["geometry"] = geometryRaw === "line" ? "Line" : geometryRaw === "area" ? "Area" : "Point";
  const min = Math.max(1, info.getMinPointCount());
  const max = Math.max(min, Math.min(50, info.getMaxPointCount()));
  return { geometry, min, max };
}

/**
 * Control points a graphic starts with when dropped at `at`. Shapes follow
 * the 2525D draw rules for each point count so drops already look doctrinal.
 */
export function defaultPointsAt(kind: ControlMeasureKind, at: [number, number]): [number, number][] {
  const [x, y] = at;
  const spec = pointSpec(kind);
  if (!spec) return [[x, y]];
  if (spec.geometry === "Point" || spec.max === 1) return [[x, y]];

  if (kind === "axis_of_advance") {
    // Route start → head, then a trailing width point.
    return [
      [x - 170, y],
      [x + 130, y],
      [x + 130, y - 55],
    ];
  }
  if (kind === "support_by_fire") {
    return [
      [x - 120, y],
      [x + 120, y],
      [x - 120, y - 110],
      [x + 120, y - 110],
    ];
  }
  if (kind === "screen" || kind === "guard" || kind === "cover" || kind === "seize") {
    return [
      [x - 130, y - 60],
      [x, y + 50],
      [x + 130, y - 60],
    ];
  }
  if (spec.min <= 2 && spec.max === 2) {
    return [
      [x - 100, y],
      [x + 100, y],
    ];
  }
  if (spec.max === 3) {
    return [
      [x - 110, y + 55],
      [x + 110, y + 55],
      [x, y - 90],
    ];
  }
  if (spec.max === 4) {
    return [
      [x - 120, y + 50],
      [x + 120, y + 50],
      [x - 60, y - 80],
      [x + 60, y - 80],
    ];
  }
  // Free polygon areas (objective, LZ, battle position, engagement area).
  const r = 110;
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
    pts.push([Math.round(x + r * Math.cos(angle)), Math.round(y + r * 0.72 * Math.sin(angle))]);
  }
  return pts;
}

export interface RenderedGraphic {
  /** Inner SVG markup (already positioned in its own local frame). */
  innerSvg: string;
  /** Paper-space placement of the returned markup. */
  x: number;
  y: number;
  width: number;
  height: number;
}

function toGeo(points: [number, number][]): string {
  return points.map(([x, y]) => `${x / PX_PER_DEGREE},${(MAP_HEIGHT - y) / PX_PER_DEGREE}`).join(" ");
}

function metaNumber(svg: string, tag: string): number | null {
  const start = svg.indexOf(`<${tag}>`);
  const end = svg.indexOf(`</${tag}>`);
  if (start < 0 || end < 0) return null;
  const value = Number.parseFloat(svg.slice(start + tag.length + 2, end));
  return Number.isFinite(value) ? value : null;
}

const cache = new Map<string, RenderedGraphic | null>();

/** Render a control measure through the Army renderer into paper space. */
export function renderControlMeasure(feature: Pick<ControlMeasure, "kind" | "geometry" | "label">): RenderedGraphic | null {
  if (!c5) return null;
  const sidc = sidcFor(feature.kind);
  if (!sidc) return null;
  const points = padPoints(feature.kind, editableVertices(feature.geometry));
  if (points.length === 0) return null;
  const key = `${sidc}|${feature.label}|${points.map((p) => `${p[0]},${p[1]}`).join(";")}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const modifiers = new Map<string, string>();
  if (feature.label) modifiers.set(c5.Modifiers.T_UNIQUE_DESIGNATION_1, feature.label);
  const attributes = new Map<string, string>();

  const spec = pointSpec(feature.kind);
  let rendered: RenderedGraphic | null = null;
  try {
    if (spec && (spec.geometry === "Point" || spec.max === 1)) {
      rendered = renderPointGraphic(sidc, points[0]!, modifiers, attributes);
    } else {
      const svg = c5.WebRenderer.RenderSymbol2D(
        "cm",
        "",
        "",
        sidc,
        toGeo(points),
        FRAME_WIDTH,
        FRAME_HEIGHT,
        FRAME_BBOX,
        modifiers,
        attributes,
        c5.WebRenderer.OUTPUT_FORMAT_GEOSVG,
      );
      rendered = parseGeoSvg(svg);
    }
  } catch {
    rendered = null;
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, rendered);
  return rendered;
}

/** Single-point control measures (destroy, TRP, checkpoint…) come from the icon renderer. */
function renderPointGraphic(
  sidc: string,
  at: [number, number],
  modifiers: Map<string, string>,
  attributes: Map<string, string>,
): RenderedGraphic | null {
  if (!c5) return null;
  const info = c5.MilStdIconRenderer.getInstance().RenderSVG(sidc, modifiers, attributes);
  if (!info) return null;
  const svg = info.getSVG();
  const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>")).trim();
  if (!inner) return null;
  const bounds = info.getImageBounds();
  const width = bounds.getWidth();
  const height = bounds.getHeight();
  return {
    innerSvg: inner,
    x: at[0] - info.getSymbolCenterX(),
    y: at[1] - info.getSymbolCenterY(),
    width,
    height,
  };
}

function parseGeoSvg(svg: string): RenderedGraphic | null {
  if (!svg || svg.startsWith("{")) return null;
  const west = metaNumber(svg, "west");
  const north = metaNumber(svg, "north");
  const width = metaNumber(svg, "width");
  const height = metaNumber(svg, "height");
  const metaEnd = svg.indexOf("</metadata>");
  const svgEnd = svg.lastIndexOf("</svg>");
  if (west == null || north == null || width == null || height == null || metaEnd < 0 || svgEnd < 0) return null;
  const innerSvg = svg.slice(metaEnd + "</metadata>".length, svgEnd).trim();
  if (!innerSvg) return null;
  return {
    innerSvg,
    x: west * PX_PER_DEGREE,
    y: MAP_HEIGHT - north * PX_PER_DEGREE,
    width,
    height,
  };
}

/** Standalone SVG data URL for palette thumbnails — the real graphic, not an icon. */
export function graphicThumbnail(kind: ControlMeasureKind): { href: string; width: number; height: number } | null {
  if (!c5) return null;
  const center: [number, number] = [800, 600];
  const rendered = renderControlMeasure({ kind, geometry: { type: "LineString", coordinates: defaultPointsAt(kind, center) }, label: "" });
  if (!rendered) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rendered.width}" height="${rendered.height}" viewBox="0 0 ${rendered.width} ${rendered.height}">${rendered.innerSvg}</svg>`;
  return {
    href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: rendered.width,
    height: rendered.height,
  };
}
