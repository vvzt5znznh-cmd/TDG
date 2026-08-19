import type { Affiliation, ControlMeasure, ControlMeasureKind, GeoGeometry } from "../schema/types";
import { addPointOnLongestEdge, centroid, editableVertices, insertVertex, scaleGeometry, setVertex } from "./geometry";
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

export type GraphicGroup = "tasks-action" | "tasks-effect" | "tasks-security" | "maneuver" | "areas" | "fires";

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
  { kind: "screen", entity: "342203", label: "Screen", group: "tasks-security", hint: "Drop the front, then click toward the protected force. Inner dots space the letters." },
  { kind: "guard", entity: "342202", label: "Guard", group: "tasks-security", hint: "Drop the front, then click toward the protected force. Inner dots space the letters." },
  { kind: "cover", entity: "342201", label: "Cover", group: "tasks-security", hint: "Drop the front, then click toward the protected force. Inner dots space the letters." },
  { kind: "support_by_fire", entity: "152100", label: "Support by fire", group: "tasks-security", hint: "Drop the firing line, then click where the arrows should point." },
  { kind: "attack_by_fire", entity: "152000", label: "Attack by fire", group: "tasks-security", hint: "Drop the firing line, then click where fire is directed." },
  { kind: "axis_of_advance", entity: "151403", label: "Axis of advance (main)", group: "maneuver", hint: "Drop the arrow, then click to set length. The diamond is head width." },
  { kind: "axis_supporting", entity: "151404", label: "Axis of advance (supporting)", group: "maneuver", hint: "Drop the arrow, then click to set length. The diamond is head width." },
  { kind: "axis_aviation", entity: "151401", label: "Axis of advance (aviation)", group: "maneuver", hint: "Drop the arrow, then click to set length. The diamond is head width." },
  { kind: "dir_atk_main", entity: "140602", label: "Direction of attack (main)", group: "maneuver", hint: "Drop the arrow, then click the tip." },
  { kind: "dir_atk_supporting", entity: "140603", label: "Direction of attack (supporting)", group: "maneuver", hint: "Drop the arrow, then click the tip." },
  { kind: "flot", entity: "140100", label: "FLOT", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "line_of_contact", entity: "140200", label: "Line of contact", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "phase_line", entity: "140300", label: "Phase line", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "feba", entity: "140400", label: "FEBA", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "pdf", entity: "140500", label: "Principal direction of fire", group: "maneuver", hint: "Drop it, then click to set the fan." },
  { kind: "limit_of_advance", entity: "140900", label: "Limit of advance", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "line_of_departure", entity: "141000", label: "Line of departure", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "ldlc", entity: "141100", label: "LD/LC", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "boundary", entity: "110100", label: "Boundary", group: "maneuver", hint: "Drop the line, then click to stretch it." },
  { kind: "checkpoint", entity: "130300", label: "Checkpoint", group: "maneuver", hint: "Click to place." },
  { kind: "objective", entity: "151700", label: "Objective", group: "areas", hint: "Drop the area, then click to scale. Drag the dots to reshape." },
  { kind: "assembly_area", entity: "150200", label: "Assembly area", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "assault_position", entity: "151500", label: "Assault position", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "attack_position", entity: "151600", label: "Attack position", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "engagement_area", entity: "151300", label: "Engagement area", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "battle_position", entity: "151200", label: "Battle position", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "drop_zone", entity: "150600", label: "Drop zone", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "pickup_zone", entity: "150900", label: "Pickup zone", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "lz", entity: "150800", label: "LZ", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "obstacle", entity: "270100", label: "Obstacle belt", group: "areas", hint: "Drop the area, then click to scale." },
  { kind: "trp", entity: "160300", label: "TRP", group: "fires", hint: "Click to place." },
  { kind: "cfl", entity: "260200", label: "CFL", group: "fires", hint: "Drop the line, then click to stretch it." },
  { kind: "fscl", entity: "260100", label: "FSCL", group: "fires", hint: "Drop the line, then click to stretch it." },
  { kind: "nfa", entity: "240301", label: "No-fire area", group: "fires", hint: "Drop the area, then click to scale." },
  { kind: "rfa", entity: "240401", label: "Restricted fire area", group: "fires", hint: "Drop the area, then click to scale." },
  { kind: "restrictive_fire_line", entity: "260500", label: "Restrictive fire line", group: "fires", hint: "Drop the line, then click to stretch it." },
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

/** APP-6(D) / MIL-STD-2525D. Used for both SIDC version digits and MSLookup. */
export const SYMBOLOGY_VERSION = 10; // APP-6(D)

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
  const version = String(SYMBOLOGY_VERSION).padStart(2, "0");
  return `${version}0${AFFILIATION_IDENTITY[affiliation]}250000${def.entity}0000`;
}

export interface PointSpec {
  geometry: "Point" | "Line" | "Area";
  min: number;
  max: number;
}

export function pointSpec(kind: ControlMeasureKind): PointSpec | null {
  const def = DEF_BY_KIND.get(kind);
  if (!def || !c5) return null;
  const info = c5.MSLookup.getInstance().getMSLInfo(`25${def.entity}`, SYMBOLOGY_VERSION);
  if (!info) return null;
  const geometryRaw = (info.getGeometry() || "point").toLowerCase();
  const geometry: PointSpec["geometry"] = geometryRaw === "line" ? "Line" : geometryRaw === "area" ? "Area" : "Point";
  const min = Math.max(1, info.getMinPointCount());
  const max = Math.max(min, Math.min(50, info.getMaxPointCount()));
  return { geometry, min, max };
}

export function isAxisKind(kind: ControlMeasureKind): boolean {
  return kind === "axis_of_advance" || kind === "axis_supporting" || kind === "axis_aviation";
}

export const DEFAULT_AXIS_WIDTH = 50;
const MIN_HEAD_PX = 10;
const MAX_HEAD_RATIO = 0.35;

export function isSecurityFront(kind: ControlMeasureKind): boolean {
  return kind === "screen" || kind === "guard" || kind === "cover";
}

export type VertexRole = "path" | "width" | "protected" | "letter";

/** How each stored control point should look. Axis width is a synthetic diamond, not a vertex. */
export function vertexRoles(kind: ControlMeasureKind, count: number): VertexRole[] {
  if (count <= 0) return [];
  if (isSecurityFront(kind)) {
    if (count >= 4) return ["path", "letter", "letter", "path"];
    if (count === 3) return ["protected", "path", "path"];
  }
  return Array<VertexRole>(count).fill("path");
}

function axisDefaults(at: [number, number]): [number, number][] {
  const [x, y] = at;
  // Stored geometry is the centreline only: tip, then rear. Head width is axisWidth.
  return [
    [x + 140, y],
    [x - 160, y],
  ];
}

function shaftLength(centreline: [number, number][]): number {
  let length = 0;
  for (let i = 1; i < centreline.length; i++) {
    const a = centreline[i - 1]!;
    const b = centreline[i]!;
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return length;
}

export function clampAxisWidth(axisWidth: number | undefined, shaftLen: number): number {
  const raw = axisWidth ?? DEFAULT_AXIS_WIDTH;
  const cap = MAX_HEAD_RATIO * shaftLen;
  return Math.max(MIN_HEAD_PX, Math.min(raw, cap > 0 ? cap : MIN_HEAD_PX));
}

/** Tip plus unit normal of the first shaft segment, scaled by `widthPx`. */
export function widthPointFor(centreline: [number, number][], widthPx: number): [number, number] {
  const tip = centreline[0] ?? [0, 0];
  const next = centreline[1] ?? [tip[0] + 1, tip[1]];
  const dx = next[0] - tip[0];
  const dy = next[1] - tip[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return [tip[0] + nx * widthPx, tip[1] + ny * widthPx];
}

/** Centreline plus the synthesised width point the Army renderer expects. */
export function axisRenderPoints(centreline: [number, number][], axisWidth?: number): [number, number][] {
  if (centreline.length === 0) return centreline;
  const padded = padAxisCentreline(centreline);
  const width = clampAxisWidth(axisWidth, shaftLength(padded));
  return [...padded, widthPointFor(padded, width)];
}

export function axisWidthFromHandle(centreline: [number, number][], handle: [number, number]): number {
  const padded = padAxisCentreline(centreline);
  const tip = padded[0] ?? [0, 0];
  const next = padded[1] ?? [tip[0] + 1, tip[1]];
  const dx = next[0] - tip[0];
  const dy = next[1] - tip[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return Math.abs((handle[0] - tip[0]) * nx + (handle[1] - tip[1]) * ny);
}

function padAxisCentreline(verts: [number, number][]): [number, number][] {
  if (verts.length === 0) return verts;
  if (verts.length === 1) {
    const tip = verts[0]!;
    return [tip, [tip[0] - 200, tip[1]]];
  }
  return verts;
}

function securityDefaults(at: [number, number]): [number, number][] {
  const [x, y] = at;
  // 4-point Cover/Screen/Guard: P0/P3 front ends, P1/P2 letter grips toward the protected force.
  return [
    [x - 160, y],
    [x - 45, y + 70],
    [x + 45, y + 70],
    [x + 160, y],
  ];
}

function hypot(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Longest edge of a 3-point screen is the front; the leftover point is the protected force. */
export function securityFrontAndProtected(verts: [number, number][]): {
  left: [number, number];
  right: [number, number];
  protectedPt: [number, number];
} | null {
  if (verts.length >= 4) {
    return {
      left: verts[0]!,
      right: verts[3]!,
      protectedPt: [(verts[1]![0] + verts[2]![0]) / 2, (verts[1]![1] + verts[2]![1]) / 2],
    };
  }
  if (verts.length !== 3) return null;
  let best = 0;
  let bestLen = -1;
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  for (let i = 0; i < 3; i++) {
    const [ia, ib] = edges[i]!;
    const len = hypot(verts[ia]!, verts[ib]!);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const [ia, ib] = edges[best]!;
  const leftover = ([0, 1, 2] as const).find((i) => i !== ia && i !== ib)!;
  return { left: verts[ia]!, right: verts[ib]!, protectedPt: verts[leftover]! };
}

/** Gap between inner letter grips as a fraction of the front length (0.12–0.9). */
export function securityLetterSpacing(geometry: GeoGeometry): number {
  const verts = editableVertices(geometry);
  if (verts.length < 4) return 0.35;
  const front = hypot(verts[0]!, verts[3]!);
  if (front < 1) return 0.35;
  return Math.max(0.12, Math.min(0.9, hypot(verts[1]!, verts[2]!) / front));
}

export function setSecurityLetterSpacing(geometry: GeoGeometry, spacing: number): GeoGeometry {
  const verts = editableVertices(geometry);
  if (verts.length < 4) return geometry;
  const p0 = verts[0]!;
  const p1 = verts[1]!;
  const p2 = verts[2]!;
  const p3 = verts[3]!;
  const fx = p3[0] - p0[0];
  const fy = p3[1] - p0[1];
  const fl = Math.hypot(fx, fy) || 1;
  const ux = fx / fl;
  const uy = fy / fl;
  const mid: [number, number] = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2];
  const innerMid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const ox = innerMid[0] - mid[0];
  const oy = innerMid[1] - mid[1];
  const along = ox * ux + oy * uy;
  const px = ox - along * ux;
  const py = oy - along * uy;
  const t = Math.max(0.12, Math.min(0.9, spacing));
  const half = (t * fl) / 2;
  let next = setVertex(geometry, 1, [mid[0] - ux * half + px, mid[1] - uy * half + py]);
  next = setVertex(next, 2, [mid[0] + ux * half + px, mid[1] + uy * half + py]);
  return next;
}

function upgradeSecurityTo4(geometry: GeoGeometry): GeoGeometry {
  const verts = editableVertices(geometry);
  const parts = securityFrontAndProtected(verts);
  if (!parts) return geometry;
  const { left, right, protectedPt } = parts;
  const coordinates: [number, number][] = [left, lerp(left, protectedPt, 0.45), lerp(right, protectedPt, 0.45), right];
  return { type: "LineString", coordinates };
}

/** Insert a point on the shaft / front. Axis stored vertices are all shaft. */
export function insertGraphicPoint(kind: ControlMeasureKind, geometry: GeoGeometry, afterIndex?: number, at?: [number, number]): GeoGeometry {
  const verts = editableVertices(geometry);
  if (isSecurityFront(kind) && verts.length === 3) return upgradeSecurityTo4(geometry);
  if (at != null && afterIndex != null) return insertVertex(geometry, afterIndex, at);
  return addPointOnLongestEdge(geometry);
}

/** Last insertable edge index for alt-click. Axis stored vertices are all shaft. */
export function graphicEdgeCount(_kind: ControlMeasureKind, vertCount: number, closed: boolean): number {
  return closed ? vertCount : Math.max(0, vertCount - 1);
}

/** Max stored vertices. Axis renderer max includes the synthesised width point. */
export function graphicStoredMax(kind: ControlMeasureKind): number | null {
  const spec = pointSpec(kind);
  if (!spec) return null;
  if (isAxisKind(kind)) return Math.max(2, spec.max - 1);
  return spec.max;
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

  if (isAxisKind(kind)) return axisDefaults(at);
  if (kind === "dir_atk_main" || kind === "dir_atk_supporting") {
    return [
      [x, y + 110],
      [x, y - 180],
    ];
  }
  if (kind === "support_by_fire") {
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
  if (isSecurityFront(kind)) return securityDefaults(at);
  if (kind === "seize") {
    return [
      [x - 80, y],
      [x + 80, y],
      [x, y + 150],
    ];
  }
  if (spec.max <= 2) {
    return [
      [x - 90, y],
      [x + 90, y],
    ];
  }
  // Line min<=2 must not run before max===3: Clear/Breach/PDF are Line-3 and
  // were dropping as collinear slivers (~14–17:1) that shadow the 3-point pose.
  if (spec.geometry === "Line" && spec.min <= 2) {
    return [
      [x - 180, y],
      [x + 180, y],
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
  if (spec.geometry === "Line" && spec.min >= 5) {
    const n = spec.min;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      pts.push([x - 180 + 360 * t, y + Math.round(Math.sin(t * Math.PI * 2) * 50)]);
    }
    return pts;
  }
  const r = 130;
  const pts: [number, number][] = [];
  for (let i = 0; i < Math.max(5, spec.min); i++) {
    const n = Math.max(5, spec.min);
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / n;
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

/** Apply one adjust-click after a stamp. `step` is 0-based. */
export function applyPlaceAdjust(kind: ControlMeasureKind, geometry: GeoGeometry, click: [number, number], step: number): GeoGeometry {
  const recipe = placeRecipe(kind);
  const verts = editableVertices(geometry);
  if (verts.length === 0) return geometry;

  if (recipe === "frontThenEnemy") {
    if (isSecurityFront(kind) && verts.length >= 4) {
      const spacing = securityLetterSpacing(geometry);
      const p0 = verts[0]!;
      const p3 = verts[3]!;
      const fx = p3[0] - p0[0];
      const fy = p3[1] - p0[1];
      const fl = Math.hypot(fx, fy) || 1;
      const ux = fx / fl;
      const uy = fy / fl;
      const half = (spacing * fl) / 2;
      let next = setVertex(geometry, 1, [click[0] - ux * half, click[1] - uy * half]);
      next = setVertex(next, 2, [click[0] + ux * half, click[1] + uy * half]);
      return next;
    }
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

/**
 * mil-sym-ts v2.10.4 emits NaN metadata for roughly 17% of axis-of-advance
 * geometries — a successful-looking response with unusable numbers, which
 * silently drops the graphic. The failure is deterministic per input but has no
 * usable pattern; perturbing the control points by a fraction of a pixel clears
 * it. Measured: recovers 100% of failures in <= 4 attempts, average 1.37.
 *
 * Offsets are far below one screen pixel, so the correction is imperceptible.
 */
const JITTER_STEPS = [0, 0.01, -0.01, 0.03, -0.03, 0.07, -0.07, 0.15, -0.15];

function renderMultipointWithRetry(
  sidc: string,
  points: [number, number][],
  modifiers: Map<string, string>,
  attributes: Map<string, string>,
): RenderedGraphic | null {
  if (!c5) return null;
  for (const eps of JITTER_STEPS) {
    const nudged: [number, number][] = eps === 0 ? points : points.map(([x, y]) => [x + eps, y + eps]);
    let svg: string;
    try {
      svg = c5.WebRenderer.RenderSymbol2D(
        "cm",
        "",
        "",
        sidc,
        toGeo(nudged),
        FRAME_WIDTH,
        FRAME_HEIGHT,
        FRAME_BBOX,
        modifiers,
        attributes,
        c5.WebRenderer.OUTPUT_FORMAT_GEOSVG,
      );
    } catch {
      continue;
    }
    const parsed = parseGeoSvg(svg);
    if (parsed) return parsed;
  }
  console.warn(`[milstd] render failed for ${sidc} after ${JITTER_STEPS.length} attempts`, points);
  return null;
}

const cache = new Map<string, RenderedGraphic | null>();

/** Render a control measure through the Army renderer into paper space. */
export function renderControlMeasure(feature: Pick<ControlMeasure, "kind" | "geometry" | "label" | "affiliation" | "axisWidth">): RenderedGraphic | null {
  if (!c5) return null;
  const sidc = sidcFor(feature.kind, feature.affiliation ?? "friendly");
  if (!sidc) return null;
  const verts = editableVertices(feature.geometry);
  const points = isAxisKind(feature.kind) ? axisRenderPoints(verts, feature.axisWidth) : padPoints(feature.kind, verts);
  if (points.length === 0) return null;
  const axisKey = isAxisKind(feature.kind) ? `|w=${feature.axisWidth ?? DEFAULT_AXIS_WIDTH}` : "";
  const key = `${sidc}|${feature.label}|${points.map((p) => `${p[0]},${p[1]}`).join(";")}${axisKey}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const modifiers = new Map<string, string>();
  if (feature.label) modifiers.set(c5.Modifiers.T_UNIQUE_DESIGNATION_1, feature.label);
  const attributes = new Map<string, string>();

  const spec = pointSpec(feature.kind);
  let rendered: RenderedGraphic | null = null;
  if (spec && (spec.geometry === "Point" || spec.max === 1)) {
    rendered = renderPointGraphic(sidc, points[0]!, modifiers, attributes);
  } else {
    rendered = renderMultipointWithRetry(sidc, points, modifiers, attributes);
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
