import type { ControlMeasureKind, MissionTaskKind } from "../schema/types";

/**
 * FM 3-90-1 tactical mission task graphics, drawn from the points the author
 * clicks. Pure path math so the editor canvas and the print sheet share it.
 * Line tasks read the drawn direction: first click is friendly, last click is
 * the enemy / objective end.
 */

type Vec = [number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const vlen = (a: Vec): number => Math.hypot(a[0], a[1]);
const unit = (a: Vec): Vec => {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** Rotate -90°: with SVG y-down, the left side of the drawn direction. Drawing west→east points this "up" at the enemy. */
const perp = (a: Vec): Vec => [a[1], -a[0]];
const lerp = (a: Vec, b: Vec, t: number): Vec => add(a, mul(sub(b, a), t));

const fmt = (n: number): string => String(Math.round(n * 10) / 10);
const pt = (v: Vec): string => `${fmt(v[0])} ${fmt(v[1])}`;

function polyPath(points: Vec[], close = false): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points as [Vec, ...Vec[]];
  return `M ${pt(first)}${rest.map((p) => ` L ${pt(p)}`).join("")}${close ? " Z" : ""}`;
}

function quadPath(from: Vec, control: Vec, to: Vec): string {
  return `M ${pt(from)} Q ${pt(control)} ${pt(to)}`;
}

/** Filled arrowhead with the tip at `tip`, pointing along `dir`. */
function headPath(tip: Vec, dir: Vec, size = 18): string {
  const n = perp(dir);
  const base = add(tip, mul(dir, -size));
  return polyPath([tip, add(base, mul(n, size * 0.45)), add(base, mul(n, -size * 0.45))], true);
}

function circlePoints(center: Vec, r: number, from = 0, to = Math.PI * 2, segments = 28): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + ((to - from) * i) / segments;
    out.push([center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)]);
  }
  return out;
}

function ellipsePoints(center: Vec, rx: number, ry: number, segments = 36): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (Math.PI * 2 * i) / segments;
    out.push([center[0] + rx * Math.cos(a), center[1] + ry * Math.sin(a)]);
  }
  return out;
}

export interface TaskStroke {
  d: string;
  dash?: string;
  width?: number;
}

export interface TaskGlyph {
  strokes: TaskStroke[];
  /** Filled shapes (arrowheads). */
  fills: string[];
  texts: { x: number; y: number; text: string; size?: number }[];
  /** Where the feature's own label should sit. */
  labelAt: Vec;
}

export interface MissionTaskDef {
  kind: MissionTaskKind;
  label: string;
  draw: "line" | "point";
  group: "actions" | "effects" | "security";
  hint: string;
}

export const MISSION_TASKS: readonly MissionTaskDef[] = [
  { kind: "seize", label: "Seize", draw: "line", group: "actions", hint: "Draw from your force to the objective." },
  { kind: "clear", label: "Clear", draw: "line", group: "actions", hint: "Draw along the area to clear." },
  { kind: "breach", label: "Breach", draw: "line", group: "actions", hint: "Draw through the obstacle." },
  { kind: "bypass", label: "Bypass", draw: "line", group: "actions", hint: "Draw past the position you avoid." },
  { kind: "canalize", label: "Canalize", draw: "line", group: "actions", hint: "Draw into the narrow zone." },
  { kind: "penetrate", label: "Penetrate", draw: "line", group: "actions", hint: "Draw through the enemy line." },
  { kind: "turn", label: "Turn", draw: "line", group: "actions", hint: "Draw the direction change." },
  { kind: "ambush", label: "Ambush", draw: "line", group: "actions", hint: "Draw from the kill position onto the route." },
  { kind: "occupy", label: "Occupy", draw: "point", group: "actions", hint: "Click the area to occupy." },
  { kind: "retain", label: "Retain", draw: "point", group: "actions", hint: "Click the terrain to retain." },
  { kind: "secure", label: "Secure", draw: "point", group: "actions", hint: "Click what to secure." },
  { kind: "block", label: "Block", draw: "line", group: "effects", hint: "Draw along the enemy avenue; the bar blocks it." },
  { kind: "fix", label: "Fix", draw: "line", group: "effects", hint: "Draw toward the enemy you fix." },
  { kind: "disrupt", label: "Disrupt", draw: "line", group: "effects", hint: "Draw from your line toward the enemy." },
  { kind: "destroy", label: "Destroy", draw: "point", group: "effects", hint: "Click the enemy to destroy." },
  { kind: "neutralize", label: "Neutralize", draw: "point", group: "effects", hint: "Click the enemy to neutralize." },
  { kind: "contain", label: "Contain", draw: "point", group: "effects", hint: "Click the enemy to contain." },
  { kind: "isolate", label: "Isolate", draw: "point", group: "effects", hint: "Click the enemy to isolate." },
  { kind: "suppress", label: "Suppress", draw: "line", group: "effects", hint: "Draw toward the target." },
  { kind: "screen", label: "Screen", draw: "line", group: "security", hint: "Draw the trace across the front." },
  { kind: "guard", label: "Guard", draw: "line", group: "security", hint: "Draw the trace across the front." },
  { kind: "cover", label: "Cover", draw: "line", group: "security", hint: "Draw the trace across the front." },
  { kind: "support_by_fire", label: "Support by fire", draw: "line", group: "security", hint: "Draw the position; arrows face your drawing hand's left." },
  { kind: "attack_by_fire", label: "Attack by fire", draw: "line", group: "security", hint: "Draw from the position toward the enemy." },
] as const;

const TASK_KINDS = new Set<string>(MISSION_TASKS.map((t) => t.kind));

export function isMissionTask(kind: ControlMeasureKind): kind is MissionTaskKind {
  return TASK_KINDS.has(kind);
}

export function missionTaskDef(kind: MissionTaskKind): MissionTaskDef {
  return MISSION_TASKS.find((t) => t.kind === kind) ?? MISSION_TASKS[0]!;
}

const HEAD = 18;

function securityGlyph(a: Vec, b: Vec, letter: string): TaskGlyph {
  const d = vlen(sub(b, a));
  const mid = lerp(a, b, 0.5);
  const n = perp(unit(sub(b, a)));
  // Vertex on the friendly side; tips point at the enemy.
  const vertex = add(mid, mul(n, -Math.min(64, d * 0.3)));
  return {
    strokes: [{ d: polyPath([a, vertex, b]) }],
    fills: [headPath(a, unit(sub(a, vertex)), HEAD), headPath(b, unit(sub(b, vertex)), HEAD)],
    texts: [{ x: vertex[0], y: vertex[1] + 26, text: letter, size: 22 }],
    labelAt: add(mid, mul(n, 24)),
  };
}

function ovalGlyph(p: Vec, decorate: (glyph: TaskGlyph, rx: number, ry: number) => void): TaskGlyph {
  const rx = 78;
  const ry = 44;
  const glyph: TaskGlyph = {
    strokes: [{ d: polyPath(ellipsePoints(p, rx, ry), true) }],
    fills: [],
    texts: [],
    labelAt: [p[0], p[1] - ry - 14],
  };
  decorate(glyph, rx, ry);
  return glyph;
}

export function missionTaskGlyph(kind: MissionTaskKind, points: Vec[]): TaskGlyph {
  const a = points[0] ?? [0, 0];
  const b = points[points.length - 1] ?? a;
  const p = a;
  const dir = unit(sub(b, a));
  const n = perp(dir);
  const d = vlen(sub(b, a)) || 1;

  switch (kind) {
    case "seize": {
      const r = 24;
      const tip = add(b, mul(dir, -r));
      return {
        strokes: [
          { d: polyPath([a, add(tip, mul(dir, -HEAD * 0.7))]) },
          { d: polyPath(circlePoints(b, r), true) },
        ],
        fills: [headPath(tip, dir, HEAD)],
        texts: [],
        labelAt: [b[0], b[1] - r - 14],
      };
    }
    case "clear": {
      const off = Math.min(26, d * 0.16);
      const rows: TaskGlyph = { strokes: [], fills: [], texts: [], labelAt: add(lerp(a, b, 0.5), mul(n, off + 22)) };
      rows.strokes.push({ d: polyPath([a, b]) });
      rows.fills.push(headPath(b, dir, HEAD));
      for (const side of [1, -1]) {
        const s = add(lerp(a, b, 0.14), mul(n, off * side));
        const e = add(lerp(a, b, 0.86), mul(n, off * side));
        rows.strokes.push({ d: polyPath([s, e]) });
        rows.fills.push(headPath(e, dir, HEAD * 0.85));
      }
      return rows;
    }
    case "fix": {
      const zStart = lerp(a, b, 0.3);
      const zEnd = lerp(a, b, 0.78);
      const zigzag: Vec[] = [zStart];
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const along = lerp(zStart, zEnd, i / steps);
        zigzag.push(add(along, mul(n, i % 2 === 1 ? 13 : -13)));
      }
      zigzag.push(zEnd);
      return {
        strokes: [{ d: polyPath([a, zStart]) }, { d: polyPath(zigzag) }, { d: polyPath([zEnd, add(b, mul(dir, -HEAD * 0.7))]) }],
        fills: [headPath(b, dir, HEAD)],
        texts: [],
        labelAt: add(lerp(a, b, 0.5), mul(n, 26)),
      };
    }
    case "block": {
      const bar = 30;
      return {
        strokes: [{ d: polyPath(points.length >= 2 ? points : [a, b]) }, { d: polyPath([add(b, mul(n, bar)), add(b, mul(n, -bar))]) }],
        fills: [],
        texts: [],
        labelAt: add(lerp(a, b, 0.5), mul(n, 22)),
      };
    }
    case "breach": {
      const gap = 17;
      const post = 34;
      const tip = add(b, mul(dir, 30));
      return {
        strokes: [
          { d: polyPath([add(b, mul(n, gap)), add(b, mul(n, gap + post))]) },
          { d: polyPath([add(b, mul(n, -gap)), add(b, mul(n, -(gap + post)))]) },
          { d: polyPath([a, add(tip, mul(dir, -HEAD * 0.7))]) },
        ],
        fills: [headPath(tip, dir, HEAD)],
        texts: [],
        labelAt: add(b, mul(n, gap + post + 16)),
      };
    }
    case "bypass": {
      const bulge = Math.min(44, d * 0.3);
      const endOff = 14;
      const mid = lerp(a, b, 0.5);
      const strokes: TaskStroke[] = [];
      const fills: string[] = [];
      for (const side of [1, -1]) {
        const end = add(b, mul(n, endOff * side));
        strokes.push({ d: quadPath(a, add(mid, mul(n, bulge * side)), add(end, mul(dir, -HEAD * 0.5))) });
        fills.push(headPath(end, dir, HEAD * 0.9));
      }
      return { strokes, fills, texts: [], labelAt: add(mid, mul(n, bulge + 20)) };
    }
    case "canalize": {
      const wide = Math.min(52, d * 0.35);
      const narrow = 16;
      return {
        strokes: [
          { d: polyPath([add(a, mul(n, wide)), add(b, mul(n, narrow))]) },
          { d: polyPath([add(a, mul(n, -wide)), add(b, mul(n, -narrow))]) },
          { d: polyPath([a, add(lerp(a, b, 0.85), mul(dir, -HEAD * 0.5))]) },
        ],
        fills: [headPath(lerp(a, b, 0.88), dir, HEAD * 0.9)],
        texts: [],
        labelAt: add(a, mul(n, wide + 18)),
      };
    }
    case "penetrate": {
      const cross = lerp(a, b, 0.72);
      return {
        strokes: [
          { d: polyPath([a, add(b, mul(dir, -HEAD * 0.7))]) },
          { d: polyPath([add(cross, mul(n, 32)), add(cross, mul(n, -32))]) },
        ],
        fills: [headPath(b, dir, HEAD)],
        texts: [],
        labelAt: add(cross, mul(n, 44)),
      };
    }
    case "turn": {
      const control = add(lerp(a, b, 0.5), mul(n, d * 0.42));
      const endDir = unit(sub(b, control));
      return {
        strokes: [{ d: quadPath(a, control, add(b, mul(endDir, -HEAD * 0.5))) }],
        fills: [headPath(b, endDir, HEAD)],
        texts: [],
        labelAt: add(control, mul(n, 16)),
      };
    }
    case "ambush": {
      const control = add(lerp(a, b, 0.72), mul(n, -d * 0.3));
      const endDir = unit(sub(b, control));
      return {
        strokes: [{ d: quadPath(a, control, add(b, mul(endDir, -HEAD * 0.5))) }],
        fills: [headPath(b, endDir, HEAD)],
        texts: [],
        labelAt: add(a, mul(n, 18)),
      };
    }
    case "disrupt": {
      const bar = 36;
      const strokes: TaskStroke[] = [{ d: polyPath([add(a, mul(n, bar)), add(a, mul(n, -bar))]) }];
      const fills: string[] = [];
      const rows: [number, number][] = [
        [24, 0.62],
        [0, 1],
        [-24, 0.8],
      ];
      for (const [off, frac] of rows) {
        const start = add(a, mul(n, off));
        const end = add(start, mul(dir, d * frac));
        strokes.push({ d: polyPath([start, add(end, mul(dir, -HEAD * 0.6))]) });
        fills.push(headPath(end, dir, HEAD * 0.9));
      }
      return { strokes, fills, texts: [], labelAt: add(a, mul(n, bar + 18)) };
    }
    case "destroy":
    case "neutralize": {
      const s = 40;
      const strokes: TaskStroke[] = [
        { d: polyPath([[p[0] - s, p[1] - s], [p[0] + s, p[1] + s]]) },
        { d: polyPath([[p[0] + s, p[1] - s], [p[0] - s, p[1] + s]]) },
      ];
      const texts = kind === "neutralize" ? [{ x: p[0], y: p[1] - s - 10, text: "N", size: 20 }] : [];
      return { strokes, fills: [], texts, labelAt: [p[0], p[1] + s + 22] };
    }
    case "contain": {
      const r = 50;
      // Open at the bottom: the enemy is held from the flanks and the front.
      const arc = circlePoints(p, r, Math.PI * 0.75, Math.PI * 2.25, 26);
      const fills: string[] = [];
      for (const frac of [0.2, 0.5, 0.8]) {
        const angle = Math.PI * 0.75 + Math.PI * 1.5 * frac;
        const tip: Vec = [p[0] + (r - 4) * Math.cos(angle), p[1] + (r - 4) * Math.sin(angle)];
        fills.push(headPath(tip, unit(sub(p, tip)), 13));
      }
      return {
        strokes: [{ d: polyPath(arc), dash: "7 5" }],
        fills,
        texts: [],
        labelAt: [p[0], p[1] + r + 20],
      };
    }
    case "isolate": {
      const r = 48;
      const fills: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const tip: Vec = [p[0] + (r - 4) * Math.cos(angle), p[1] + (r - 4) * Math.sin(angle)];
        fills.push(headPath(tip, unit(sub(p, tip)), 13));
      }
      return {
        strokes: [{ d: polyPath(circlePoints(p, r), true), dash: "7 5" }],
        fills,
        texts: [],
        labelAt: [p[0], p[1] - r - 12],
      };
    }
    case "occupy":
      return ovalGlyph(p, (glyph, rx) => {
        const start: Vec = [p[0] - rx - 26, p[1] + 30];
        const tip: Vec = [p[0] - 8, p[1] + 2];
        const arrowDir = unit(sub(tip, start));
        glyph.strokes.push({ d: polyPath([start, add(tip, mul(arrowDir, -HEAD * 0.6))]) });
        glyph.fills.push(headPath(tip, arrowDir, HEAD * 0.9));
      });
    case "retain":
      return ovalGlyph(p, (glyph, rx, ry) => {
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI * (0.15 + (0.7 * i) / 4);
          const base: Vec = [p[0] + rx * Math.cos(angle), p[1] + ry * Math.sin(angle)];
          const out = unit(sub(base, p));
          const tip = add(base, mul(out, 20));
          glyph.strokes.push({ d: polyPath([base, add(tip, mul(out, -8))]) });
          glyph.fills.push(headPath(tip, out, 11));
        }
      });
    case "secure":
      return ovalGlyph(p, (glyph, rx) => {
        glyph.strokes[0] = { ...glyph.strokes[0]!, dash: "8 6" };
        glyph.fills.push(headPath([p[0] + rx, p[1] - 8], [0, -1], 14));
      });
    case "suppress":
      return {
        strokes: [{ d: polyPath([a, add(b, mul(dir, -HEAD * 0.7))]) }],
        fills: [headPath(b, dir, HEAD)],
        texts: [{ x: a[0] - dir[0] * 18, y: a[1] - dir[1] * 18 + 6, text: "S", size: 20 }],
        labelAt: add(lerp(a, b, 0.5), mul(n, 22)),
      };
    case "screen":
      return securityGlyph(a, b, "S");
    case "guard":
      return securityGlyph(a, b, "G");
    case "cover":
      return securityGlyph(a, b, "C");
    case "attack_by_fire": {
      const tailBase = add(a, mul(dir, -20));
      return {
        strokes: [
          { d: polyPath([a, add(b, mul(dir, -HEAD * 0.7))]) },
          { d: polyPath([add(tailBase, mul(n, 16)), a, add(tailBase, mul(n, -16))]) },
        ],
        fills: [headPath(b, dir, HEAD)],
        texts: [],
        labelAt: add(lerp(a, b, 0.5), mul(n, 22)),
      };
    }
    case "support_by_fire": {
      const arm = Math.min(84, d * 0.55);
      const strokes: TaskStroke[] = [{ d: polyPath(points.length >= 2 ? points : [a, b]) }];
      const fills: string[] = [];
      for (const end of [a, b]) {
        const tip = add(end, mul(n, arm));
        strokes.push({ d: polyPath([end, add(tip, mul(n, -HEAD * 0.6))]) });
        fills.push(headPath(tip, n, HEAD * 0.9));
      }
      return { strokes, fills, texts: [], labelAt: add(lerp(a, b, 0.5), mul(n, -18)) };
    }
  }
}
