import { describe, expect, it } from "vitest";
import { createSymbolFromStamp, parseUnitStamp } from "./stamp";
import { functionIdFromSidc } from "./sidc";

describe("unit stamps", () => {
  it("rejects junk drag payloads", () => {
    expect(parseUnitStamp("not-json")).toBeNull();
    expect(parseUnitStamp("{}")).toBeNull();
    expect(parseUnitStamp(JSON.stringify({ functionId: "x" }))).toBeNull();
  });

  it("creates a named custom unit from a stamp", () => {
    const symbol = createSymbolFromStamp(
      { functionId: "UCI", designation: "1st Squad", echelon: "squad" },
      [400, 500],
      { affiliation: "friendly", echelon: "platoon" },
    );
    expect(symbol.designation).toBe("1st Squad");
    expect(symbol.echelon).toBe("squad");
    expect(symbol.affiliation).toBe("friendly");
    expect(functionIdFromSidc(symbol.sidc)).toBe("UCI");
    expect(symbol.position.coordinates).toEqual([400, 500]);
  });

  it("uses live whose when the stamp has no affiliation", () => {
    const symbol = createSymbolFromStamp({ functionId: "UCA" }, [0, 0], { affiliation: "hostile", echelon: "company" });
    expect(symbol.affiliation).toBe("hostile");
    expect(symbol.confidence).toBe("suspected");
    expect(symbol.echelon).toBe("company");
    expect(symbol.frame).toBe("diamond");
  });
});
