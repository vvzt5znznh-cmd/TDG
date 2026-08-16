import { describe, expect, it } from "vitest";
import ms from "milsymbol";
import { buildSidc, UNIT_CATALOG } from "./sidc";

describe("SIDC builder", () => {
  it("builds valid APP-6 symbols for the unit catalog", () => {
    ms.setStandard("APP6");
    for (const unit of UNIT_CATALOG) {
      const sidc = buildSidc({
        affiliation: "friendly",
        confidence: "confirmed",
        echelon: "platoon",
        functionId: unit.functionId,
      });
      const symbol = new ms.Symbol(sidc, { size: 32 });
      expect(symbol.isValid(), `${unit.label} ${sidc}`).toBe(true);
    }
  });

  it("uses anticipated status for suspected/templated (dashed frame)", () => {
    const sidc = buildSidc({
      affiliation: "hostile",
      confidence: "suspected",
      echelon: "company",
      functionId: "UCI",
    });
    expect(sidc[3]).toBe("A");
    expect(new ms.Symbol(sidc).isValid()).toBe(true);
  });

  it("encodes headquarters and task force in SIDC position 11", () => {
    const plain = buildSidc({ affiliation: "friendly", confidence: "confirmed", echelon: "platoon", functionId: "UCI" });
    const hq = buildSidc({
      affiliation: "friendly",
      confidence: "confirmed",
      echelon: "platoon",
      functionId: "UCI",
      headquarters: true,
    });
    const tf = buildSidc({
      affiliation: "friendly",
      confidence: "confirmed",
      echelon: "platoon",
      functionId: "UCI",
      taskForce: true,
    });
    expect(plain).toBe("SFGPUCI----D");
    expect(hq[10]).toBe("A");
    expect(tf[10]).toBe("E");
    expect(new ms.Symbol(hq).getMetadata().headquarters).toBe(true);
    expect(new ms.Symbol(tf).getMetadata().taskForce).toBe(true);
  });
});
