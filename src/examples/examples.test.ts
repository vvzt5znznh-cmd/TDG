import { describe, expect, it } from "vitest";
import { parseTDGFileText, serializeTDGFile } from "../schema/parse";
import { validateScenario } from "../validator/validate";
import { SHIPPED_EXAMPLES } from "./index";

describe("shipped examples", () => {
  it("puts swamp, road, and woods on the vector base, not a baked picture", () => {
    for (const example of SHIPPED_EXAMPLES) {
      if (!("dilemma" in example.file.content)) continue;
      const map = example.file.content.maps[0];
      expect(map?.base.kind, example.title).toBe("vector");
      if (map?.base.kind !== "vector") throw new Error("vector");
      const kinds = map.base.features.map((feature) => feature.kind);
      expect(kinds, example.title).toEqual(expect.arrayContaining(["wetland", "road", "woods"]));
    }
  });

  it.each(SHIPPED_EXAMPLES.map((example) => [example.title, example] as const))(
    "%s parses, round-trips, and passes the validator",
    (_title, example) => {
      const parsed = parseTDGFileText(serializeTDGFile(example.file));
      expect(parsed.fileType).toBe("scenario");
      if (!("dilemma" in parsed.content)) throw new Error("expected scenario");
      const result = validateScenario(parsed.content);
      expect(result.errors, result.errors.map((issue) => issue.code).join(", ")).toEqual([]);
      expect(result.warnings, result.warnings.map((issue) => issue.code).join(", ")).toEqual([]);
    },
  );
});
