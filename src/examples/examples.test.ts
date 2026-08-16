import { describe, expect, it } from "vitest";
import { parseTDGFileText, serializeTDGFile } from "../schema/parse";
import { validateScenario } from "../validator/validate";
import { SHIPPED_EXAMPLES } from "./index";

describe("shipped examples", () => {
  it("includes at least five original scenarios", () => {
    expect(SHIPPED_EXAMPLES.length).toBeGreaterThanOrEqual(5);
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
