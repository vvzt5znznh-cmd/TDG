// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import {
  GRAPHIC_DEFS,
  applyPlaceAdjust,
  defaultPointsAt,
  ensureMilStd,
  graphicThumbnail,
  isMilStdReady,
  placeRecipe,
  placeSteps,
  pointSpec,
  renderControlMeasure,
  sidcFor,
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

  it("drops occupy as two points and screen as a front plus a protected-force point", () => {
    const occupy = defaultPointsAt("occupy", [800, 600]);
    expect(occupy).toHaveLength(2);
    const screen = defaultPointsAt("screen", [800, 600]);
    expect(screen).toHaveLength(3);
    expect(screen[0]![1]).toBe(screen[1]![1]);
    expect(screen[2]![1]).toBeGreaterThan(screen[0]![1]);
  });

  it("stamp-then-adjust: occupy scales about its centroid; seize then aims the arrow", () => {
    expect(placeRecipe("occupy")).toBe("scale");
    expect(placeRecipe("seize")).toBe("circleThenArrow");
    expect(placeSteps(placeRecipe("seize"))).toBe(2);
    const occupy = { type: "LineString" as const, coordinates: defaultPointsAt("occupy", [800, 600]) };
    const grown = applyPlaceAdjust("occupy", occupy, [800, 200], 0);
    const before = Math.hypot(occupy.coordinates[1]![0] - occupy.coordinates[0]![0], occupy.coordinates[1]![1] - occupy.coordinates[0]![1]);
    const after = Math.hypot(grown.type === "LineString" ? grown.coordinates[1]![0] - grown.coordinates[0]![0] : 0, grown.type === "LineString" ? grown.coordinates[1]![1] - grown.coordinates[0]![1] : 0);
    expect(after).toBeGreaterThan(before);
    const seize = { type: "LineString" as const, coordinates: defaultPointsAt("seize", [800, 600]) };
    const aimed = applyPlaceAdjust("seize", seize, [500, 900], 1);
    expect(aimed.type).toBe("LineString");
    if (aimed.type !== "LineString") throw new Error("line");
    expect(aimed.coordinates[2]).toEqual([500, 900]);
  });
});
