import type { Affiliation, ControlMeasure, ControlMeasureKind, GeoGeometry } from "../schema/types";
import { centroid, editableVertices, scaleGeometry, setVertex } from "./geometry";
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
  hint: string;
}

/**
 * Entity codes read from the renderer's own MIL-STD-2525D symbol table
 * (Control Measure symbol set 25), not transcribed from memory.
 */
export const GRAPHIC_DEFS: readonly GraphicDef[] = [
  { kind: "seize", entity: "342300", label: "Seize", group: "tasks-action", hint: "Drop the circle, click to size it, then click the arrow tail." },
  { kind: "clear", entity: "340500", label: "Clear", group: "tasks-action", hint: "Drop it, then click to set how far the arrows reach." },
  { kind: "breach", entity: "340200", label: "Breach", group: "tasks-action", hint: "Drop it, then click to set width and depth." },
  { kind: "bypass", entity: "340300", label: "Bypass", group: "tasks-action", hint: "Drop it, then click to set how far the arms go around." },
  { kind: "canalize", entity: "340400", label: "Canalize", group: "tasks-action", hint: "Drop it, then click to set the funnel." },
  { kind: "penetrate", entity: "341800", label: "Penetrate", group: "tasks-action", hint: "Drop it, then click to set how far it drives through." },
  { kind: "turn", entity: "270504", label: "Turn", group: "tasks-action", hint: "Drop it, then click to set size." },
  { kind: "ambush", entity: "141700", label: "Ambush", group: "tasks-action", hint: "Drop it, then click to set the arms." },
  { kind: "occupy", entity: "341700", label: "Occupy", group: "tasks-action", hint: "Drop the circle, then click to scale it." },
  { kind: "retain", entity: "151205", label: "Retain", group: "tasks-action", hint: "Drop the circle, then click to scale it." },
  { kind: "secure", entity: "342100", label: "Secure", group: "tasks-action", hint: "Drop the circle, then click to scale it." },
  { kind: "block", entity: "340100", label: "Block", group: "tasks-effect", hint: "Drop it, then click to set size." },
  { kind: "fix", entity: "341100", label: "Fix", group: "tasks-effect", hint: "Drop it, then click to set length." },
  { kind: "disrupt", entity: "341000", label: "Disrupt", group: "tasks-effect", hint: "Drop it, then click to set size." },
  { kind: "destroy", entity: "340900", label: "Destroy", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "neutralize", entity: "341600", label: "Neutralize", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "contain", entity: "151204", label: "Contain", group: "tasks-effect", hint: "Drop it, then click to set size." },
  { kind: "isolate", entity: "341500", label: "Isolate", group: "tasks-effect", hint: "Drop the circle, then click to scale it." },
  { kind: "suppress", entity: "342800", label: "Suppress", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "screen", entity: "342203", label: "Screen", group: "tasks-security", hint: "Drop the front, then click toward the protected force." },
  { kind: "guard", entity: "342202", label: "Guard", group: "tasks-security", hint: "Drop the front, then click toward the protected force." },
  { kind: "cover", entity: "342201", label: "Cover", group: "tasks-security", hint: "Drop the front, then click toward the protected force." },
  { kind: "support_by_fire", entity: "152100", label: "Support by fire", group: "tasks-security", hint: "Drop the firing line, then click where the arrows should point." },
  { kind: "attack_by_fire", entity: "152000", label: "Attack by fire", group: "tasks-security", hint: "Drop the firing line, then click where fire is directed." },
  { kind: "objective", entity: "151700", label: "Objective", group: "measures", hint: "Drop the area, then click to scale. Drag the dots to reshape." },
  { kind: "phase_line", entity: "140300", label: "Phase line", group: "measures", hint: "Drop the line, then click to stretch it." },
  { kind: "axis_of_advance", entity: "151404", label: "Axis of advance", group: "measures", hint: "Drop the arrow, then click to set length. Last dot is head width." },
  { kind: "boundary", entity: "110100", label: "Boundary", group: "measures", hint: "Drop the line, then click to stretch it." },
  { kind: "engagement_area", entity: "151300", label: "Engagement area", group: "measures", hint: "Drop the area, then click to scale." },
  { kind: "battle_position", entity: "151200", label: "Battle position", group: "measures", hint: "Drop the area, then click to scale." },
  { kind: "trp", entity: "160300", label: "TRP", group: "measures", hint: "Click to place." },
  { kind: "checkpoint", entity: "130300", label: "Checkpoint", group: "measures", hint: "Click to place." },
  { kind: "lz", entity: "150800", label: "LZ", group: "measures", hint: "Drop the area, then click to scale." },
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

const AFFILIATION_IDENTITY: Record<Affiliation, string> = {
  unknown: "1",
  friendly: "3",
  neutral: "4",
  hostile: "6",
};

export function sidcFor(kind: ControlMeasureKind, affiliation: Affiliation = "friendly"): string | undefined {
  const def = DEF_BY_KIND.get(kind);
  if (!def) return undefined;
  return `100${AFFILIATION_IDENTITY[affiliation]}250000${def.entity}0000`;
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
    return [
      [x - 170, y],
      [x + 130, y],
      [x + 130, y - 55],
    ];
  }
  if (kind === "support_by_fire") {
    // Firing line, then the two arrow heads toward the enemy (up on the sheet).
    return [
      [x - 120, y],
      [x + 120, y],
      [x - 80, y - 120],
      [x + 80, y - 120],
    ];
  }
  if (kind === "attack_by_fire") {
    return [
      [x - 110, y],
      [x + 110, y],
      [x, y - 120],
    ];
  }
  if (kind === "screen" || kind === "guard" || kind === "cover") {
    // Front along X; last point is the protected force (down the sheet).
    return [
      [x - 140, y],
      [x + 140, y],
      [x, y + 90],
    ];
  }
  if (kind === "seize") {
    // Diameter of the objective circle, then the arrow tail.
    return [
      [x - 80, y],
      [x + 80, y],
      [x, y + 150],
    ];
  }
  if (spec.min <= 2 && spec.max === 2) {
    return [
      [x, y],
      [x + 95, y],
    ];
  }
  if (spec.max === 3) {
    return [
      [x - 110, y],
      [x + 110, y],
      [x, y - 100],
    ];
  }
  if (spec.max === 4) {
    return [
      [x - 120, y],
      [x + 120, y],
      [x - 60, y - 90],
      [x + 60, y - 90],
    ];
  }
  const r = 110;
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 5;
    pts.push([Math.round(x + r * Math.cos(angle)), Math.round(y + r * 0.72 * Math.sin(angle))]);
  }
  return pts;
}

export type PlaceRecipe = "stamp" | "scale" | "circleThenArrow" | "frontThenEnemy";

export function placeRecipe(kind: ControlMeasureKind): PlaceRecipe {
  switch (kind) {
    case "seize":
      return "circleThenArrow";
    case "screen":
    case "guard":
    case "cover":
    case "support_by_fire":
    case "attack_by_fire":
      return "frontThenEnemy";
    case "destroy":
    case "neutralize":
    case "suppress":
    case "trp":
    case "checkpoint":
      return "stamp";
    default:
      return "scale";
  }
}

export function placeSteps(recipe: PlaceRecipe): number {
  if (recipe === "stamp") return 0;
  if (recipe === "circleThenArrow") return 2;
  return 1;
}

export function placeHint(kind: ControlMeasureKind, step: number): string {
  const def = graphicDef(kind);
  const name = def?.label ?? kind;
  const recipe = placeRecipe(kind);
  if (recipe === "circleThenArrow") {
    return step === 0 ? `${name} — click to set the circle size.` : `${name} — click the tail of the arrow.`;
  }
  if (recipe === "frontThenEnemy") {
    return kind === "support_by_fire" || kind === "attack_by_fire"
      ? `${name} — click where the arrows should point.`
      : `${name} — click toward the protected force.`;
  }
  if (recipe === "scale") return `${name} — click to set the size. Esc when it looks right.`;
  return `${name} — drag to move.`;
}

function hypot(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Apply one adjust-click after a stamp. `step` is 0-based. */
export function applyPlaceAdjust(kind: ControlMeasureKind, geometry: GeoGeometry, click: [number, number], step: number): GeoGeometry {
  const recipe = placeRecipe(kind);
  const verts = editableVertices(geometry);
  if (verts.length === 0) return geometry;

  if (recipe === "frontThenEnemy") {
    if (kind === "support_by_fire" && verts.length >= 4) {
      const a = verts[0]!;
      const b = verts[1]!;
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const length = Math.max(hypot(click, mid), 8);
      const dx = click[0] - mid[0];
      const dy = click[1] - mid[1];
      const dist = Math.hypot(dx, dy) || 1;
      const ux = (dx / dist) * length;
      const uy = (dy / dist) * length;
      let next = setVertex(geometry, 2, [a[0] + ux, a[1] + uy]);
      next = setVertex(next, 3, [b[0] + ux, b[1] + uy]);
      return next;
    }
    return setVertex(geometry, verts.length - 1, click);
  }

  if (recipe === "circleThenArrow" && step >= 1) {
    return setVertex(geometry, verts.length - 1, click);
  }

  const center = centroid(verts);
  const radius = Math.max(...verts.map((v) => hypot(center, v)), 8);
  const nextRadius = Math.max(hypot(center, click), 8);
  return scaleGeometry(geometry, nextRadius / radius, center);
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
export function renderControlMeasure(feature: Pick<ControlMeasure, "kind" | "geometry" | "label" | "affiliation">): RenderedGraphic | null {
  if (!c5) return null;
  const sidc = sidcFor(feature.kind, feature.affiliation ?? "friendly");
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
