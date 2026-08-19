import { describe, expect, it } from "vitest";
import { createSymbolFromStamp, layerRoleForAffiliation } from "./stamp";
import { functionIdFromSidc } from "./sidc";

describe("unit stamps", () => {
  it("creates a named unit from the live composer fields", () => {
    const symbol = createSymbolFromStamp(
      { functionId: "UCI", designation: "1st Squad", echelon: "squad", affiliation: "friendly" },
      [400, 500],
    );
    expect(symbol.designation).toBe("1st Squad");
    expect(symbol.echelon).toBe("squad");
    expect(symbol.affiliation).toBe("friendly");
    expect(functionIdFromSidc(symbol.sidc)).toBe("UCI");
    expect(symbol.position.coordinates).toEqual([400, 500]);
  });

  it("puts each identity on its own overlay layer", () => {
    expect(layerRoleForAffiliation("friendly", "all")).toBe("friendly");
    expect(layerRoleForAffiliation("hostile", "student")).toBe("enemy_known");
    expect(layerRoleForAffiliation("hostile", "facilitator")).toBe("enemy_truth");
    expect(layerRoleForAffiliation("neutral", "all")).toBe("neutral");
    expect(layerRoleForAffiliation("unknown", "all")).toBe("unknown");
  });

  it("uses suspected confidence for hostile identity", () => {
    const symbol = createSymbolFromStamp({ functionId: "UCA", affiliation: "hostile", echelon: "company" }, [0, 0]);
    expect(symbol.confidence).toBe("suspected");
    expect(symbol.frame).toBe("diamond");
  });

  it("omits a blank designation so milsymbol does not draw an empty name", () => {
    const symbol = createSymbolFromStamp(
      { functionId: "UCI", designation: "   ", affiliation: "friendly", echelon: "platoon" },
      [0, 0],
    );
    expect(symbol.designation).toBeUndefined();
  });
});
