import type { ControlMeasure } from "../schema/types";
import { centroid, pointsOf } from "./geometry";

export function arrowHeadPoints(from: [number, number], to: [number, number], size = 22): string {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const left: [number, number] = [to[0] - size * Math.cos(angle - Math.PI / 7), to[1] - size * Math.sin(angle - Math.PI / 7)];
  const right: [number, number] = [to[0] - size * Math.cos(angle + Math.PI / 7), to[1] - size * Math.sin(angle + Math.PI / 7)];
  return `${to[0]},${to[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`;
}

export function tickAt(from: [number, number], to: [number, number], length = 14): [[number, number], [number, number]] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  const mid: [number, number] = [from[0], from[1]];
  return [
    [mid[0] - nx * length, mid[1] - ny * length],
    [mid[0] + nx * length, mid[1] + ny * length],
  ];
}

export function controlMeasureStyle(kind: ControlMeasure["kind"]): { color: string; dash?: string; width: number } {
  if (kind === "boundary") return { color: "#1b2118", dash: "10 7", width: 2.5 };
  if (kind === "axis_of_advance") return { color: "#1b2118", width: 3.5 };
  if (kind === "phase_line") return { color: "#1b2118", width: 3 };
  if (kind === "engagement_area" || kind === "battle_position") return { color: "#1b2118", dash: "8 5", width: 2 };
  return { color: "#1b2118", width: 2 };
}

export function labelAnchor(feature: ControlMeasure): [number, number] {
  const pts = pointsOf(feature.geometry);
  if (pts.length === 0) return [0, 0];
  if (feature.geometry.type === "Point") return pts[0] ?? [0, 0];
  return centroid(pts);
}
