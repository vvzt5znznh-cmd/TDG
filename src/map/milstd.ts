import type { Affiliation, ControlMeasure, ControlMeasureKind, GeoGeometry } from "../schema/types";
import { addPointOnLongestEdge, editableVertices, insertVertex, longestEdgeIndex, removeVertex, setVertex } from "./geometry";
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
  { kind: "seize", entity: "342300", label: "Seize", group: "tasks-action", hint: "Click the circle’s two sides, then the arrow tail." },
  { kind: "clear", entity: "340500", label: "Clear", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "breach", entity: "340200", label: "Breach", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "bypass", entity: "340300", label: "Bypass", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "canalize", entity: "340400", label: "Canalize", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "penetrate", entity: "341800", label: "Penetrate", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "turn", entity: "270504", label: "Turn", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "ambush", entity: "141700", label: "Ambush", group: "tasks-action", hint: "Click each control point. Space finishes." },
  { kind: "occupy", entity: "341700", label: "Occupy", group: "tasks-action", hint: "Click two points across the circle." },
  { kind: "retain", entity: "151205", label: "Retain", group: "tasks-action", hint: "Click two points across the circle." },
  { kind: "secure", entity: "342100", label: "Secure", group: "tasks-action", hint: "Click two points across the circle." },
  { kind: "block", entity: "340100", label: "Block", group: "tasks-effect", hint: "Click each control point. Space finishes." },
  { kind: "fix", entity: "341100", label: "Fix", group: "tasks-effect", hint: "Click each control point. Space finishes." },
  { kind: "disrupt", entity: "341000", label: "Disrupt", group: "tasks-effect", hint: "Click each control point. Space finishes." },
  { kind: "destroy", entity: "340900", label: "Destroy", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "neutralize", entity: "341600", label: "Neutralize", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "contain", entity: "151204", label: "Contain", group: "tasks-effect", hint: "Click each control point. Space finishes." },
  { kind: "isolate", entity: "341500", label: "Isolate", group: "tasks-effect", hint: "Click two points across the circle." },
  { kind: "suppress", entity: "342800", label: "Suppress", group: "tasks-effect", hint: "Click to place. Drag to move." },
  { kind: "screen", entity: "342203", label: "Screen", group: "tasks-security", hint: "Click the front, then the letter grips toward the protected force. Space finishes." },
  { kind: "guard", entity: "342202", label: "Guard", group: "tasks-security", hint: "Click the front, then the letter grips toward the protected force. Space finishes." },
  { kind: "cover", entity: "342201", label: "Cover", group: "tasks-security", hint: "Click the front, then the letter grips toward the protected force. Space finishes." },
  { kind: "support_by_fire", entity: "152100", label: "Support by fire", group: "tasks-security", hint: "Click the firing line, then the arrow tips. Space finishes." },
  { kind: "attack_by_fire", entity: "152000", label: "Attack by fire", group: "tasks-security", hint: "Click the firing line, then where fire is directed. Space finishes." },
  { kind: "axis_of_advance", entity: "151403", label: "Axis of advance (main)", group: "maneuver", hint: "Click the tip, then the shaft. Move to set head width; Space finishes." },
  { kind: "axis_supporting", entity: "151404", label: "Axis of advance (supporting)", group: "maneuver", hint: "Click the tip, then the shaft. Move to set head width; Space finishes." },
  { kind: "axis_aviation", entity: "151401", label: "Axis of advance (aviation)", group: "maneuver", hint: "Click the tip, then the shaft. Move to set head width; Space finishes." },
  { kind: "dir_atk_main", entity: "140602", label: "Direction of attack (main)", group: "maneuver", hint: "Click the tail, then the tip." },
  { kind: "dir_atk_supporting", entity: "140603", label: "Direction of attack (supporting)", group: "maneuver", hint: "Click the tail, then the tip." },
  { kind: "flot", entity: "140100", label: "FLOT", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "line_of_contact", entity: "140200", label: "Line of contact", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "phase_line", entity: "140300", label: "Phase line", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "feba", entity: "140400", label: "FEBA", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "pdf", entity: "140500", label: "Principal direction of fire", group: "maneuver", hint: "Click the origin, then the fan. Space finishes." },
  { kind: "limit_of_advance", entity: "140900", label: "Limit of advance", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "line_of_departure", entity: "141000", label: "Line of departure", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "ldlc", entity: "141100", label: "LD/LC", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "boundary", entity: "110100", label: "Boundary", group: "maneuver", hint: "Click along the line. Space or Enter finishes." },
  { kind: "checkpoint", entity: "130300", label: "Checkpoint", group: "maneuver", hint: "Click to place." },
  { kind: "objective", entity: "151700", label: "Objective", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "assembly_area", entity: "150200", label: "Assembly area", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "assault_position", entity: "151500", label: "Assault position", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "attack_position", entity: "151600", label: "Attack position", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "engagement_area", entity: "151300", label: "Engagement area", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "battle_position", entity: "151200", label: "Battle position", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "drop_zone", entity: "150600", label: "Drop zone", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "pickup_zone", entity: "150900", label: "Pickup zone", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "lz", entity: "150800", label: "LZ", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "obstacle", entity: "270100", label: "Obstacle belt", group: "areas", hint: "Click the outline. Space or Enter finishes." },
  { kind: "trp", entity: "160300", label: "TRP", group: "fires", hint: "Click to place." },
  { kind: "cfl", entity: "260200", label: "CFL", group: "fires", hint: "Click along the line. Space or Enter finishes." },
  { kind: "fscl", entity: "260100", label: "FSCL", group: "fires", hint: "Click along the line. Space or Enter finishes." },
  { kind: "nfa", entity: "240301", label: "No-fire area", group: "fires", hint: "Click the outline. Space or Enter finishes." },
  { kind: "rfa", entity: "240401", label: "Restricted fire area", group: "fires", hint: "Click the outline. Space or Enter finishes." },
  { kind: "restrictive_fire_line", entity: "260500", label: "Restrictive fire line", group: "fires", hint: "Click along the line. Space or Enter finishes." },
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

export function isAxisKind(kind: ControlMeasureKind): boolean {
  return kind === "axis_of_advance" || kind === "axis_supporting" || kind === "axis_aviation";
}

export function isSecurityFront(kind: ControlMeasureKind): boolean {
  return kind === "screen" || kind === "guard" || kind === "cover";
}

export type VertexRole = "path" | "width" | "protected" | "letter";

/** How each control point should look. Width sits off the ink; letter grips space S/G/C. */
export function vertexRoles(kind: ControlMeasureKind, count: number): VertexRole[] {
  if (count <= 0) return [];
  if (isAxisKind(kind) && count >= 3) {
    return [...Array<VertexRole>(count - 1).fill("path"), "width"];
  }
  if (isSecurityFront(kind)) {
    if (count >= 4) return ["path", "letter", "letter", "path"];
    if (count === 3) return ["protected", "path", "path"];
  }
  return Array<VertexRole>(count).fill("path");
}

/** Head width as a fraction of shaft length. */
export const AXIS_HEAD_RATIO = 0.18;
export const AXIS_HEAD_MIN = 0.08;
export const AXIS_HEAD_MAX = 0.35;

export function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += hypot(pts[i]!, pts[i + 1]!);
  return len;
}

function clampHeadRatio(ratio: number): number {
  return Math.max(AXIS_HEAD_MIN, Math.min(AXIS_HEAD_MAX, ratio));
}

/** Unit perpendicular to the first shaft segment (tip → next). */
function axisPerp(shaft: [number, number][]): [number, number] {
  const tip = shaft[0];
  const next = shaft[1];
  if (!tip || !next) return [0, -1];
  const dx = next[0] - tip[0];
  const dy = next[1] - tip[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

export function defaultAxisWidthPoint(shaft: [number, number][], ratio = AXIS_HEAD_RATIO): [number, number] {
  const tip = shaft[0];
  if (!tip) return [0, 0];
  const [px, py] = axisPerp(shaft);
  const width = clampHeadRatio(ratio) * Math.max(polylineLength(shaft), 1);
  return [tip[0] + px * width, tip[1] + py * width];
}

export function axisHeadRatio(shaft: [number, number][], widthPt: [number, number]): number {
  const tip = shaft[0];
  if (!tip) return AXIS_HEAD_RATIO;
  return hypot(tip, widthPt) / Math.max(polylineLength(shaft), 1);
}

/** Project a click onto the perpendicular through the tip and clamp head size. */
export function constrainAxisWidthPoint(shaft: [number, number][], click: [number, number]): [number, number] {
  const tip = shaft[0];
  if (!tip) return click;
  const [px, py] = axisPerp(shaft);
  const signed = (click[0] - tip[0]) * px + (click[1] - tip[1]) * py;
  const len = Math.max(polylineLength(shaft), 1);
  const sign = signed < 0 ? -1 : 1;
  const mag = Math.max(AXIS_HEAD_MIN * len, Math.min(AXIS_HEAD_MAX * len, Math.abs(signed) < 1 ? AXIS_HEAD_RATIO * len : Math.abs(signed)));
  return [tip[0] + px * mag * sign, tip[1] + py * mag * sign];
}

export function maintainAxisWidth(geometry: GeoGeometry): GeoGeometry {
  const verts = editableVertices(geometry);
  if (verts.length < 3) return geometry;
  const shaft = verts.slice(0, -1);
  const width = verts[verts.length - 1]!;
  return setVertex(geometry, verts.length - 1, constrainAxisWidthPoint(shaft, width));
}

function axisDefaults(at: [number, number]): [number, number][] {
  const [x, y] = at;
  const tip: [number, number] = [x + 150, y];
  const rear: [number, number] = [x - 150, y];
  return [tip, rear, defaultAxisWidthPoint([tip, rear])];
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

/** Insert a point on the shaft / front — never after an Axis2 width point. */
export function insertGraphicPoint(kind: ControlMeasureKind, geometry: GeoGeometry, afterIndex?: number, at?: [number, number]): GeoGeometry {
  const verts = editableVertices(geometry);
  if (isSecurityFront(kind) && verts.length === 3) return upgradeSecurityTo4(geometry);
  if (isAxisKind(kind) && verts.length >= 3) {
    const shaft = verts.slice(0, -1);
    const edge = afterIndex == null ? longestEdgeIndex(shaft, false) : Math.min(afterIndex, Math.max(0, shaft.length - 2));
    const a = shaft[Math.max(0, edge)]!;
    const b = shaft[Math.min(shaft.length - 1, edge + 1)]!;
    const point = at ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return insertVertex(geometry, edge, point);
  }
  if (at != null && afterIndex != null) return insertVertex(geometry, afterIndex, at);
  return addPointOnLongestEdge(geometry);
}

/** Last insertable edge index for alt-click (excludes Axis2 width edge). */
export function graphicEdgeCount(kind: ControlMeasureKind, vertCount: number, closed: boolean): number {
  if (isAxisKind(kind) && vertCount >= 3) return vertCount - 2;
  return closed ? vertCount : Math.max(0, vertCount - 1);
}

export function setGraphicVertex(kind: ControlMeasureKind, geometry: GeoGeometry, index: number, point: [number, number]): GeoGeometry {
  const verts = editableVertices(geometry);
  if (isAxisKind(kind) && verts.length >= 3) {
    if (index === verts.length - 1) {
      return setVertex(geometry, index, constrainAxisWidthPoint(verts.slice(0, -1), point));
    }
    return maintainAxisWidth(setVertex(geometry, index, point));
  }
  return setVertex(geometry, index, point);
}

export function canDeleteGraphicPoint(kind: ControlMeasureKind, count: number, index: number): boolean {
  const spec = pointSpec(kind);
  const min = spec?.min ?? 1;
  if (count <= min) return false;
  if (isAxisKind(kind)) {
    if (index === count - 1) return false;
    if (count <= 3) return false;
  }
  return index >= 0 && index < count;
}

export function deleteGraphicPoint(kind: ControlMeasureKind, geometry: GeoGeometry, index: number): GeoGeometry {
  const verts = editableVertices(geometry);
  if (!canDeleteGraphicPoint(kind, verts.length, index)) return geometry;
  const next = removeVertex(geometry, index);
  return isAxisKind(kind) ? maintainAxisWidth(next) : next;
}

export function geometryFromPoints(points: [number, number][]): GeoGeometry {
  if (points.length <= 1) return { type: "Point", coordinates: points[0] ?? [0, 0] };
  return { type: "LineString", coordinates: points };
}

/** Live preview points. Axis treats the cursor as head width once two shaft points exist. */
export function previewPoints(kind: ControlMeasureKind, points: [number, number][], cursor?: [number, number] | null): [number, number][] {
  if (isAxisKind(kind)) {
    if (points.length >= 2) {
      const width = cursor ? constrainAxisWidthPoint(points, cursor) : defaultAxisWidthPoint(points);
      return [...points, width];
    }
    return cursor ? [...points, cursor] : points;
  }
  return cursor ? [...points, cursor] : points;
}

export function canFinishDraw(kind: ControlMeasureKind, count: number): boolean {
  if (isAxisKind(kind)) return count >= 2;
  const spec = pointSpec(kind);
  if (!spec) return count >= 1;
  return count >= spec.min;
}

/** True when this click should commit immediately (1-point or fixed-count). */
export function shouldAutoCommit(kind: ControlMeasureKind, count: number): boolean {
  if (isAxisKind(kind)) return false;
  const spec = pointSpec(kind);
  if (!spec) return count >= 1;
  if (spec.max === 1) return count >= 1;
  if (spec.min === spec.max) return count >= spec.min;
  return count >= spec.max;
}

export function commitDrawPoints(kind: ControlMeasureKind, points: [number, number][], cursor?: [number, number] | null): [number, number][] {
  if (isAxisKind(kind)) {
    const width = cursor ? constrainAxisWidthPoint(points, cursor) : defaultAxisWidthPoint(points);
    return [...points, width];
  }
  return points;
}

export function drawHint(kind: ControlMeasureKind, count: number): string {
  const def = graphicDef(kind);
  const name = def?.label ?? kind;
  const spec = pointSpec(kind);
  if (isAxisKind(kind)) {
    if (count <= 0) return `${name} — click the tip.`;
    if (count === 1) return `${name} — click the rear of the shaft.`;
    return `${name} — click more shaft, or Space to finish. Move to set head width.`;
  }
  if (!spec || spec.max === 1) return `${name} — click to place.`;
  if (count <= 0) return `${name} — click the first point. Esc cancels.`;
  if (spec.min === spec.max) {
    const left = spec.min - count;
    return left <= 1 ? `${name} — click the last point.` : `${name} — ${left} more points.`;
  }
  if (count < spec.min) return `${name} — ${spec.min - count} more, then Space to finish.`;
  return `${name} — click more, or Space / Enter to finish.`;
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
  if (spec.geometry === "Line") {
    const count = Math.max(2, spec.min);
    const pts: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      pts.push([x - 180 + 360 * t, y]);
    }
    return pts;
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
  const r = 130;
  const pts: [number, number][] = [];
  for (let i = 0; i < Math.max(5, spec.min); i++) {
    const n = Math.max(5, spec.min);
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / n;
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
export function renderControlMeasure(
  feature: Pick<ControlMeasure, "kind" | "geometry" | "label" | "affiliation"> & { id?: string },
): RenderedGraphic | null {
  if (!c5) return null;
  const sidc = sidcFor(feature.kind, feature.affiliation ?? "friendly");
  if (!sidc) return null;
  const raw = editableVertices(feature.geometry);
  const points = feature.id === "ghost" ? raw : padPoints(feature.kind, raw);
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

/** Compact, well-proportioned control points for palette chips. */
function thumbnailPoints(kind: ControlMeasureKind): [number, number][] {
  const at: [number, number] = [80, 48];
  if (isAxisKind(kind)) {
    const tip: [number, number] = [148, 48];
    const rear: [number, number] = [12, 48];
    return [tip, rear, defaultAxisWidthPoint([tip, rear], 0.22)];
  }
  if (kind === "dir_atk_main" || kind === "dir_atk_supporting") {
    return [
      [18, 48],
      [142, 48],
    ];
  }
  if (isSecurityFront(kind)) {
    return [
      [12, 36],
      [48, 72],
      [112, 72],
      [148, 36],
    ];
  }
  if (kind === "seize") {
    return [
      [36, 48],
      [92, 48],
      [64, 88],
    ];
  }
  const full = defaultPointsAt(kind, at);
  if (full.length <= 1) return full;
  const cx = at[0];
  const cy = at[1];
  return full.map(([x, y]) => [cx + (x - cx) * 0.42, cy + (y - cy) * 0.42]);
}

function svgInkBounds(markup: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  };
  for (const match of markup.matchAll(/\bpoints="([^"]+)"/g)) {
    const nums = match[1]!.trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) add(nums[i]!, nums[i + 1]!);
  }
  for (const match of markup.matchAll(/\bd="([^"]+)"/g)) {
    const nums = [...match[1]!.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((item) => Number(item[0]));
    for (let i = 0; i + 1 < nums.length; i += 2) add(nums[i]!, nums[i + 1]!);
  }
  for (const tag of markup.matchAll(/<(?:line|circle|ellipse|rect)[^>]*\/?>/g)) {
    const attr = (name: string): number | undefined => {
      const found = tag[0].match(new RegExp(`\\b${name}="([^"]+)"`));
      return found ? Number(found[1]) : undefined;
    };
    const x = attr("x") ?? attr("x1") ?? attr("cx");
    const y = attr("y") ?? attr("y1") ?? attr("cy");
    if (x != null && y != null) add(x, y);
    const x2 = attr("x2");
    const y2 = attr("y2");
    if (x2 != null && y2 != null) add(x2, y2);
    const r = attr("r") ?? attr("rx");
    if (x != null && y != null && r != null) {
      add(x - r, y - r);
      add(x + r, y + r);
    }
    const w = attr("width");
    const h = attr("height");
    if (x != null && y != null && w != null && h != null) add(x + w, y + h);
  }
  if (xs.length === 0) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Standalone SVG data URL for palette thumbnails — the real graphic, not an icon. */
export function graphicThumbnail(kind: ControlMeasureKind): { href: string; width: number; height: number } | null {
  if (!c5) return null;
  const points = thumbnailPoints(kind);
  const geometry = geometryFromPoints(points);
  const rendered = renderControlMeasure({ kind, geometry, label: "", affiliation: "friendly" });
  if (!rendered) return null;
  const ink = svgInkBounds(rendered.innerSvg);
  const pad = 6;
  const minX = ink ? ink.minX - pad : -pad;
  const minY = ink ? ink.minY - pad : -pad;
  const width = Math.max(8, (ink ? ink.maxX - ink.minX : rendered.width) + pad * 2);
  const height = Math.max(8, (ink ? ink.maxY - ink.minY : rendered.height) + pad * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">${rendered.innerSvg}</svg>`;
  return {
    href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width,
    height,
  };
}
