import { describe, expect, it } from "vitest";
import { createBlankScenario } from "../schema/create";
import { makeValidScenario } from "./fixtures";
import { allMapFeatures, validateScenario, type IssueCode } from "./validate";

function codes(level: "error" | "warning", scenario = makeValidScenario()): IssueCode[] {
  const result = validateScenario(scenario);
  return result[level === "error" ? "errors" : "warnings"].map((issue) => issue.code);
}

describe("validator: valid fixture", () => {
  it("treats vector-base terrain as student-visible features", () => {
    const scenario = makeValidScenario();
    const swamp = allMapFeatures(scenario.maps).find(({ feature }) => feature.id === "feat_western_swamp");
    expect(swamp?.layer.visibleIn).toContain("student");
    expect(swamp?.feature.featureType).toBe("terrain");
  });
});

describe("validator: errors", () => {
  it("dilemma_statement_empty", () => {
    const scenario = makeValidScenario();
    scenario.dilemma.statement = "  ";
    expect(codes("error", scenario)).toContain("dilemma_statement_empty");
  });

  it("dilemma_dependencies_empty", () => {
    const scenario = makeValidScenario();
    scenario.dilemma.dependencies = [];
    expect(codes("error", scenario)).toContain("dilemma_dependencies_empty");
  });

  it("time_limit_missing", () => {
    const scenario = makeValidScenario();
    scenario.requirement.timeLimitMinutes = 0;
    expect(codes("error", scenario)).toContain("time_limit_missing");
  });

  it("deliverables_empty", () => {
    const scenario = makeValidScenario();
    scenario.requirement.deliverables = [];
    expect(codes("error", scenario)).toContain("deliverables_empty");
  });

  it("higher_intent_two_up_empty", () => {
    const scenario = makeValidScenario();
    scenario.situation.higherIntentTwoUp = "";
    expect(codes("error", scenario)).toContain("higher_intent_two_up_empty");
  });

  it("no_time_expired_outcome", () => {
    const scenario = makeValidScenario();
    scenario.outcomeStates = scenario.outcomeStates.filter((state) => state.kind !== "time_expired");
    expect(codes("error", scenario)).toContain("no_time_expired_outcome");
  });

  it("too_few_outcome_states", () => {
    const scenario = makeValidScenario();
    scenario.outcomeStates = scenario.outcomeStates.slice(0, 2);
    expect(codes("error", scenario)).toContain("too_few_outcome_states");
  });

  it("enemy_truth_visible_to_student", () => {
    const scenario = makeValidScenario();
    const layer = scenario.maps[0]?.layers.find((item) => item.role === "enemy_truth");
    if (!layer) throw new Error("missing layer");
    layer.visibleIn = ["student", "facilitator"];
    expect(codes("error", scenario)).toContain("enemy_truth_visible_to_student");
  });

  it("solution_overlay_visible_to_student", () => {
    const scenario = makeValidScenario();
    const layer = scenario.maps[0]?.layers.find((item) => item.role === "solution_overlay");
    if (!layer) throw new Error("missing layer");
    layer.visibleIn = ["student"];
    expect(codes("error", scenario)).toContain("solution_overlay_visible_to_student");
  });

  it("status_overlay_dangling_ref", () => {
    const scenario = makeValidScenario();
    scenario.forces.statusOverlay.push({
      taskOrgNodeId: "does-not-exist",
      strength: { assigned: 1, effective: 1 },
      ammunition: "full",
    });
    expect(codes("error", scenario)).toContain("status_overlay_dangling_ref");
  });

  it("map_missing_scale_or_north", () => {
    const scenario = makeValidScenario();
    const map = scenario.maps[0];
    if (!map) throw new Error("missing map");
    map.scaleBar.meters = 0;
    expect(codes("error", scenario)).toContain("map_missing_scale_or_north");
  });
});

describe("validator: warnings", () => {
  it("unit_named_but_absent", () => {
    const scenario = makeValidScenario();
    scenario.situation.friendly += " 3rd Squad is already on the objective.";
    expect(codes("warning", scenario)).toContain("unit_named_but_absent");
  });

  it("unit_never_referenced", () => {
    const scenario = makeValidScenario();
    scenario.situation.attachmentsDetachments = "Nothing attached.";
    expect(codes("warning", scenario)).toContain("unit_never_referenced");
  });

  it("terrain_dep_missing_feature_refs", () => {
    const scenario = makeValidScenario();
    const terrainDep = scenario.dilemma.dependencies.find((dep) => dep.kind === "terrain");
    if (!terrainDep) throw new Error("missing dep");
    terrainDep.mapFeatureRefs = [];
    expect(codes("warning", scenario)).toContain("terrain_dep_missing_feature_refs");
  });

  it("map_feature_ref_not_student_visible", () => {
    const scenario = makeValidScenario();
    const map = scenario.maps[0];
    if (!map || map.base.kind !== "vector") throw new Error("missing vector base");
    const swampId = "feat_western_swamp";
    const swamp = map.base.features.find((feature) => feature.id === swampId);
    const solution = map.layers.find((item) => item.role === "solution_overlay");
    if (!swamp || !solution) throw new Error("missing swamp or solution overlay");
    map.base = { kind: "vector", features: map.base.features.filter((feature) => feature.id !== swampId) };
    solution.features.push(swamp);
    expect(codes("warning", scenario)).toContain("map_feature_ref_not_student_visible");
  });

  it("all_features_load_bearing", () => {
    const scenario = makeValidScenario();
    const ids = allMapFeatures(scenario.maps).map(({ feature }) => feature.id);
    scenario.dilemma.dependencies[0] = {
      kind: "terrain",
      description: "Everything on the map is the dilemma.",
      mapFeatureRefs: ids,
    };
    expect(codes("warning", scenario)).toContain("all_features_load_bearing");
  });

  it("situation_names_missing_feature", () => {
    const scenario = makeValidScenario();
    scenario.situation.general += " Hill 412 dominates the eastern approach.";
    expect(codes("warning", scenario)).toContain("situation_names_missing_feature");
  });

  it("confirmed_enemy_without_ground_truth", () => {
    const scenario = makeValidScenario();
    scenario.situation.enemy.groundTruth = "";
    const enemyKnown = scenario.maps[0]?.layers.find((item) => item.role === "enemy_known");
    const symbol = enemyKnown?.features.find((feature) => feature.featureType === "symbol");
    if (symbol && symbol.featureType === "symbol") symbol.confidence = "confirmed";
    expect(codes("warning", scenario)).toContain("confirmed_enemy_without_ground_truth");
  });

  it("estimated_time_too_large", () => {
    const scenario = makeValidScenario();
    scenario.meta.estimatedMinutes = 90;
    scenario.requirement.timeLimitMinutes = 15;
    expect(codes("warning", scenario)).toContain("estimated_time_too_large");
  });

  it("not_fictionalized", () => {
    const scenario = makeValidScenario();
    scenario.meta.setting.fictionalized = false;
    expect(codes("warning", scenario)).toContain("not_fictionalized");
  });
});

describe("validator: blank scenario", () => {
  it("blocks export on a new blank file", () => {
    const result = validateScenario(createBlankScenario());
    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "dilemma_statement_empty",
        "dilemma_dependencies_empty",
        "higher_intent_two_up_empty",
      ]),
    );
  });
});
