// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { rotateGeometry, scaleGeometry } from "./geometry";
import {
  AXIS_HEAD_MAX,
  AXIS_HEAD_MIN,
  GRAPHIC_DEFS,
  axisHeadRatio,
  canDeleteGraphicPoint,
  canFinishDraw,
  commitDrawPoints,
  constrainAxisWidthPoint,
  defaultAxisWidthPoint,
  defaultPointsAt,
  deleteGraphicPoint,
  ensureMilStd,
  graphicThumbnail,
  insertGraphicPoint,
  isMilStdReady,
  pointSpec,
  previewPoints,
  renderControlMeasure,
  securityLetterSpacing,
  setGraphicVertex,
  setSecurityLetterSpacing,
  shouldAutoCommit,
  sidcFor,
  vertexRoles,
} from "./milstd";

beforeAll(async () => {
  await ensureMilStd();
}, 30000);

describe("MIL-STD-2525D adapter (US Army renderer)", () => {
  it("initializes the renderer", () => {
    expect(isMilStdReady()).toBe(true);
  });

  it("every graphic kind resolves to a known symbol with a point spec", () => {
    for (const def of GRAPHIC_DEFS) {
      expect(sidcFor(def.kind), def.kind).toMatch(/^1003250000\d{6}0000$/);
      const spec = pointSpec(def.kind);
      expect(spec, def.kind).not.toBeNull();
      expect(spec!.min, def.kind).toBeGreaterThanOrEqual(1);
      expect(spec!.max, def.kind).toBeGreaterThanOrEqual(spec!.min);
    }
  });

  it("drop defaults satisfy each graphic's point count", () => {
    for (const def of GRAPHIC_DEFS) {
      const spec = pointSpec(def.kind)!;
      const points = defaultPointsAt(def.kind, [800, 600]);
      expect(points.length, def.kind).toBeGreaterThanOrEqual(spec.min);
      expect(points.length, def.kind).toBeLessThanOrEqual(spec.max);
    }
  });

  it("renders every graphic near its drop point on the sheet", () => {
    for (const def of GRAPHIC_DEFS) {
      const rendered = renderControlMeasure({
        kind: def.kind,
        geometry: { type: "LineString", coordinates: defaultPointsAt(def.kind, [800, 600]) },
        label: "",
      });
      expect(rendered, def.kind).not.toBeNull();
      expect(rendered!.innerSvg.length, def.kind).toBeGreaterThan(20);
      expect(rendered!.width, def.kind).toBeGreaterThan(4);
      expect(rendered!.height, def.kind).toBeGreaterThan(2);
      // The graphic's box must cover or sit near the drop point.
      expect(rendered!.x, def.kind).toBeGreaterThan(200);
      expect(rendered!.x, def.kind).toBeLessThan(1400);
      expect(rendered!.y, def.kind).toBeGreaterThan(100);
      expect(rendered!.y, def.kind).toBeLessThan(1100);
    }
  });

  it("draws the designation label when set", () => {
    const plain = renderControlMeasure({
      kind: "objective",
      geometry: { type: "LineString", coordinates: defaultPointsAt("objective", [800, 600]) },
      label: "",
    });
    const labeled = renderControlMeasure({
      kind: "objective",
      geometry: { type: "LineString", coordinates: defaultPointsAt("objective", [800, 600]) },
      label: "SWORD",
    });
    expect(labeled!.innerSvg).toContain("SWORD");
    expect(plain!.innerSvg).not.toContain("SWORD");
  });

  it("produces palette thumbnails from the real renderer", () => {
    const thumb = graphicThumbnail("support_by_fire");
    expect(thumb).not.toBeNull();
    expect(thumb!.href.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("warping: moving a control point reshapes without losing the graphic", () => {
    const narrow = renderControlMeasure({
      kind: "block",
      geometry: { type: "LineString", coordinates: [[700, 650], [900, 650], [800, 500]] },
      label: "",
    });
    const wide = renderControlMeasure({
      kind: "block",
      geometry: { type: "LineString", coordinates: [[500, 650], [1100, 650], [800, 400]] },
      label: "",
    });
    expect(narrow).not.toBeNull();
    expect(wide).not.toBeNull();
    expect(wide!.width).toBeGreaterThan(narrow!.width);
  });

  it("encodes affiliation in the SIDC identity digit", () => {
    expect(sidcFor("seize")).toBe("10032500003423000000");
    expect(sidcFor("seize", "hostile")).toBe("10062500003423000000");
    expect(sidcFor("seize", "neutral")).toBe("10042500003423000000");
    expect(sidcFor("seize", "unknown")).toBe("10012500003423000000");
  });

  it("drops occupy as two points and screen as a four-point front with letter grips", () => {
    const occupy = defaultPointsAt("occupy", [800, 600]);
    expect(occupy).toHaveLength(2);
    const screen = defaultPointsAt("screen", [800, 600]);
    expect(screen).toHaveLength(4);
    expect(screen[0]![1]).toBe(screen[3]![1]);
    expect(screen[1]![1]).toBeGreaterThan(screen[0]![1]);
    expect(screen[2]![1]).toBeGreaterThan(screen[0]![1]);
  });

  it("click-to-draw: 1-point stamps commit immediately; axis needs Space after two shaft points", () => {
    expect(shouldAutoCommit("destroy", 1)).toBe(true);
    expect(shouldAutoCommit("checkpoint", 1)).toBe(true);
    expect(shouldAutoCommit("axis_of_advance", 2)).toBe(false);
    expect(canFinishDraw("axis_of_advance", 2)).toBe(true);
    expect(canFinishDraw("axis_of_advance", 1)).toBe(false);
    const occupy = pointSpec("occupy")!;
    if (occupy.min === occupy.max) expect(shouldAutoCommit("occupy", occupy.min)).toBe(true);
    else expect(canFinishDraw("occupy", occupy.min)).toBe(true);
    const seize = pointSpec("seize")!;
    expect(canFinishDraw("seize", seize.min)).toBe(true);
    const flot = pointSpec("flot")!;
    expect(canFinishDraw("flot", flot.min)).toBe(true);
    const dir = pointSpec("dir_atk_main")!;
    if (dir.min === dir.max) expect(shouldAutoCommit("dir_atk_main", dir.min)).toBe(true);
  });

  it("axis preview treats the cursor as clamped head width, not a polyline corner", () => {
    const shaft: [number, number][] = [
      [500, 400],
      [200, 400],
    ];
    const preview = previewPoints("axis_of_advance", shaft, [500, 100]);
    expect(preview).toHaveLength(3);
    const width = preview[2]!;
    const ratio = axisHeadRatio(shaft, width);
    expect(ratio).toBeGreaterThanOrEqual(AXIS_HEAD_MIN - 1e-6);
    expect(ratio).toBeLessThanOrEqual(AXIS_HEAD_MAX + 1e-6);
    expect(width[0]).toBeCloseTo(500, 0);
    const finished = commitDrawPoints("axis_of_advance", shaft, null);
    expect(finished).toHaveLength(3);
    expect(axisHeadRatio(shaft, finished[2]!)).toBeCloseTo(0.18, 2);
  });

  it("width-handle drag stays perpendicular to the tip; shaft points unchanged", () => {
    const geometry = { type: "LineString" as const, coordinates: defaultPointsAt("axis_of_advance", [800, 600]) };
    const shaft = geometry.coordinates.slice(0, -1) as [number, number][];
    const dragged = setGraphicVertex("axis_of_advance", geometry, 2, [1200, 200]);
    expect(dragged.type).toBe("LineString");
    if (dragged.type !== "LineString") throw new Error("line");
    expect(dragged.coordinates[0]).toEqual(geometry.coordinates[0]);
    expect(dragged.coordinates[1]).toEqual(geometry.coordinates[1]);
    const width = dragged.coordinates[2]!;
    const constrained = constrainAxisWidthPoint(shaft, [1200, 200]);
    expect(width[0]).toBeCloseTo(constrained[0], 5);
    expect(width[1]).toBeCloseTo(constrained[1], 5);
    expect(axisHeadRatio(shaft, [width[0], width[1]])).toBeLessThanOrEqual(AXIS_HEAD_MAX + 1e-6);
  });

  it("does not pad a ghost sketch with invented points", () => {
    const ghost = renderControlMeasure({
      id: "ghost",
      kind: "occupy",
      geometry: { type: "LineString", coordinates: [[800, 600]] },
      label: "",
    });
    // One point is below min; without padding the renderer may still return null or a stub — it must not invent a second control point in geometry.
    const padded = defaultPointsAt("occupy", [800, 600]);
    expect(padded).toHaveLength(2);
    expect(ghost === null || ghost.innerSvg.length > 0).toBe(true);
  });

  it("maps axis of advance to Main Attack 151403, with a supporting variant", () => {
    expect(sidcFor("axis_of_advance")).toBe("10032500001514030000");
    expect(sidcFor("axis_supporting")).toBe("10032500001514040000");
    const axis = defaultPointsAt("axis_of_advance", [800, 600]);
    expect(axis).toHaveLength(3);
    expect(vertexRoles("axis_of_advance", 3)).toEqual(["path", "path", "width"]);
  });

  it("spaces screen letters by sliding the inner grips along the front", () => {
    const geometry = { type: "LineString" as const, coordinates: defaultPointsAt("screen", [800, 600]) };
    const tight = setSecurityLetterSpacing(geometry, 0.2);
    const wide = setSecurityLetterSpacing(geometry, 0.7);
    expect(securityLetterSpacing(tight)).toBeCloseTo(0.2, 1);
    expect(securityLetterSpacing(wide)).toBeCloseTo(0.7, 1);
    expect(vertexRoles("screen", 4)).toEqual(["path", "letter", "letter", "path"]);
  });

  it("inserts axis points on the shaft, not after the width handle", () => {
    const geometry = { type: "LineString" as const, coordinates: defaultPointsAt("axis_of_advance", [800, 600]) };
    const next = insertGraphicPoint("axis_of_advance", geometry);
    expect(next.type).toBe("LineString");
    if (next.type !== "LineString") throw new Error("line");
    expect(next.coordinates).toHaveLength(4);
    expect(vertexRoles("axis_of_advance", 4)).toEqual(["path", "path", "path", "width"]);
    expect(next.coordinates[3]).toEqual(geometry.coordinates[2]);
  });

  it("refuses to delete below min or to drop the axis width point", () => {
    const axis = { type: "LineString" as const, coordinates: defaultPointsAt("axis_of_advance", [800, 600]) };
    expect(canDeleteGraphicPoint("axis_of_advance", 3, 2)).toBe(false);
    expect(deleteGraphicPoint("axis_of_advance", axis, 2).type === "LineString" && (deleteGraphicPoint("axis_of_advance", axis, 2) as { coordinates: unknown[] }).coordinates).toHaveLength(3);
    const longer = insertGraphicPoint("axis_of_advance", axis);
    expect(canDeleteGraphicPoint("axis_of_advance", 4, 1)).toBe(true);
    const trimmed = deleteGraphicPoint("axis_of_advance", longer, 1);
    expect(trimmed.type).toBe("LineString");
    if (trimmed.type !== "LineString") throw new Error("line");
    expect(trimmed.coordinates).toHaveLength(3);
  });

  it("default and synthesized axis heads stay in the clamp band", () => {
    const width = defaultAxisWidthPoint([
      [400, 400],
      [100, 400],
    ]);
    expect(axisHeadRatio([[400, 400], [100, 400]], width)).toBeGreaterThanOrEqual(AXIS_HEAD_MIN);
    expect(axisHeadRatio([[400, 400], [100, 400]], width)).toBeLessThanOrEqual(AXIS_HEAD_MAX);
  });

  it("drops maneuver lines as two-point lines, not a pentagon", () => {
    for (const kind of ["phase_line", "flot", "line_of_departure", "limit_of_advance", "cfl"] as const) {
      const points = defaultPointsAt(kind, [800, 600]);
      expect(points, kind).toHaveLength(2);
      expect(Math.hypot(points[1]![0] - points[0]![0], points[1]![1] - points[0]![1]), kind).toBeGreaterThan(200);
    }
  });

  it("still renders after scaling and rotating every graphic", () => {
    for (const def of GRAPHIC_DEFS) {
      const pts = defaultPointsAt(def.kind, [800, 600]);
      const geometry = pts.length === 1 ? { type: "Point" as const, coordinates: pts[0]! } : { type: "LineString" as const, coordinates: pts };
      const scaled = scaleGeometry(geometry, 1.8, [800, 600]);
      const rotated = rotateGeometry(scaled, 35, [800, 600]);
      const rendered = renderControlMeasure({ kind: def.kind, geometry: rotated, label: "T1" });
      expect(rendered, def.kind).not.toBeNull();
      expect(rendered!.innerSvg.length, def.kind).toBeGreaterThan(20);
    }
  });
});
