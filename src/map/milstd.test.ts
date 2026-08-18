// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import {
  GRAPHIC_DEFS,
  defaultPointsAt,
  ensureMilStd,
  graphicThumbnail,
  isMilStdReady,
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
});
