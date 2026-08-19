import { describe, expect, it } from "vitest";
import { mapImageRef } from "../map/mapBase";
import { createNewFile } from "../schema/create";
import { parseTDGFileText, serializeTDGFile } from "../schema/parse";
import { suggestedFileName } from "./files";

describe("file I/O helpers", () => {
  it("builds a .tdg.json filename from the title", () => {
    expect(suggestedFileName("Two bridges at Korsmyr")).toBe("two-bridges-at-korsmyr.tdg.json");
    expect(suggestedFileName("   ")).toBe("scenario.tdg.json");
  });

  it("round-trips unknown keys and an embedded underlay through serialize", () => {
    const file = createNewFile({ title: "Cache fixture" });
    const withExtras = {
      ...file,
      unknownKeys: { notebook: { page: 12 } },
    };
    const text = serializeTDGFile(withExtras);
    const parsed = parseTDGFileText(text);
    expect(parsed.unknownKeys).toEqual({ notebook: { page: 12 } });
    const imageRef =
      "dilemma" in file.content && file.content.maps[0]
        ? mapImageRef(file.content.maps[0]) ?? ""
        : "";
    expect(parsed.assets?.[imageRef]).toMatch(/^data:image\//);
  });
});
