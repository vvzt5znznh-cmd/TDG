import { describe, expect, it } from "vitest";
import { MISSION_TASKS, isMissionTask, missionTaskGlyph } from "./missionTasks";
import { mapFeatureSchema } from "../schema/zod";

const LINE: [number, number][] = [
  [200, 600],
  [600, 600],
];
const POINT: [number, number][] = [[400, 400]];

describe("tactical mission task graphics", () => {
  it("draws every task in the catalog", () => {
    for (const def of MISSION_TASKS) {
      const glyph = missionTaskGlyph(def.kind, def.draw === "line" ? LINE : POINT);
      expect(glyph.strokes.length, def.kind).toBeGreaterThan(0);
      expect(glyph.labelAt, def.kind).toBeDefined();
      for (const stroke of glyph.strokes) {
        expect(stroke.d, def.kind).toMatch(/^M /);
        expect(stroke.d, def.kind).not.toContain("NaN");
      }
      for (const fill of glyph.fills) {
        expect(fill, def.kind).not.toContain("NaN");
      }
    }
  });

  it("every catalog kind is a valid control measure in the file schema", () => {
    for (const def of MISSION_TASKS) {
      const parsed = mapFeatureSchema.safeParse({
        featureType: "control_measure",
        id: `cm_${def.kind}`,
        kind: def.kind,
        geometry:
          def.draw === "line"
            ? { type: "LineString", coordinates: LINE }
            : { type: "Point", coordinates: POINT[0] },
        label: "",
      });
      expect(parsed.success, def.kind).toBe(true);
    }
  });

  it("block is the drawn line plus a perpendicular bar at the enemy end", () => {
    const glyph = missionTaskGlyph("block", LINE);
    expect(glyph.strokes).toHaveLength(2);
    // Drawn west→east: the bar at the far end must be vertical (same x, split y).
    const bar = glyph.strokes[1]!.d;
    const coords = bar.match(/-?[\d.]+/g)!.map(Number);
    expect(coords[0]).toBeCloseTo(coords[2]!, 0);
    expect(coords[1]).not.toBeCloseTo(coords[3]!, 0);
  });

  it("fix has a zigzag and an arrowhead pointing at the enemy", () => {
    const glyph = missionTaskGlyph("fix", LINE);
    expect(glyph.strokes.length).toBeGreaterThanOrEqual(3);
    expect(glyph.fills).toHaveLength(1);
    // Arrowhead tip sits at the drawn end.
    expect(glyph.fills[0]).toContain("M 600 600");
  });

  it("security tasks letter their trace", () => {
    expect(missionTaskGlyph("screen", LINE).texts[0]?.text).toBe("S");
    expect(missionTaskGlyph("guard", LINE).texts[0]?.text).toBe("G");
    expect(missionTaskGlyph("cover", LINE).texts[0]?.text).toBe("C");
  });

  it("keeps mission tasks apart from plain control measures", () => {
    expect(isMissionTask("seize")).toBe(true);
    expect(isMissionTask("support_by_fire")).toBe(true);
    expect(isMissionTask("phase_line")).toBe(false);
    expect(isMissionTask("objective")).toBe(false);
  });

  it("point tasks draw around the clicked spot", () => {
    const destroy = missionTaskGlyph("destroy", POINT);
    expect(destroy.strokes).toHaveLength(2);
    const isolate = missionTaskGlyph("isolate", POINT);
    expect(isolate.fills.length).toBeGreaterThanOrEqual(4);
    const contain = missionTaskGlyph("contain", POINT);
    expect(contain.strokes[0]?.dash).toBeDefined();
  });
});
