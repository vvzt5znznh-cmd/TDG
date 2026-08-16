import { isTimeExpiredOutcome } from "../schema/presets";
import { allDesignations, allTaskOrgIds, flattenTaskOrg } from "../schema/taskOrg";
import type { MapDocument, MapFeature, Scenario } from "../schema/types";

export type IssueLevel = "error" | "warning";

export type IssueCode =
  | "dilemma_statement_empty"
  | "dilemma_dependencies_empty"
  | "time_limit_missing"
  | "deliverables_empty"
  | "higher_intent_two_up_empty"
  | "no_time_expired_outcome"
  | "too_few_outcome_states"
  | "enemy_truth_visible_to_student"
  | "solution_overlay_visible_to_student"
  | "status_overlay_dangling_ref"
  | "map_missing_scale_or_north"
  | "unit_named_but_absent"
  | "unit_never_referenced"
  | "terrain_dep_missing_feature_refs"
  | "map_feature_ref_not_student_visible"
  | "all_features_load_bearing"
  | "situation_names_missing_feature"
  | "confirmed_enemy_without_ground_truth"
  | "estimated_time_too_large"
  | "not_fictionalized";

export interface ValidationIssue {
  code: IssueCode;
  level: IssueLevel;
  message: string;
  path?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  ok: boolean;
}

const UNIT_PATTERN =
  /\b(?:\d+(?:st|nd|rd|th)\s+(?:Squad|Platoon|Company|Battalion|Troop|Section)|(?:Squad|Platoon|Company|Battalion)\s+(?:\d+|[A-Z])\b|\d+\.\s*(?:plut|plt|kompani|coy)\b)/gi;

const NAMED_FEATURE_PATTERN =
  /\b(?:OBJ(?:ECTIVE)?|PL|EA|BP|TRP|LZ)\s+[A-Z][A-Z0-9-]+|\b(?:Hill|Route)\s+[A-Z0-9][A-Za-z0-9-]*/g;

function issue(code: IssueCode, level: IssueLevel, message: string, path?: string): ValidationIssue {
  return { code, level, message, path };
}

function narrativeBlob(scenario: Scenario): string {
  const s = scenario.situation;
  return [
    scenario.dilemma.statement,
    s.general,
    s.enemy.known,
    s.enemy.assessedIntent,
    s.friendly,
    s.higherMission,
    s.higherIntent,
    s.higherIntentTwoUp,
    s.attachmentsDetachments,
    s.civilConsiderations ?? "",
    scenario.requirement.role,
    scenario.requirement.perspective,
    scenario.requirement.prompt,
  ].join("\n");
}

export function loadBearingFeatureIds(scenario: Scenario): Set<string> {
  const ids = new Set<string>();
  for (const dep of scenario.dilemma.dependencies) {
    for (const ref of dep.mapFeatureRefs ?? []) {
      ids.add(ref);
    }
  }
  return ids;
}

export function allMapFeatures(maps: MapDocument[]): { feature: MapFeature; layer: MapDocument["layers"][number]; map: MapDocument }[] {
  const out: { feature: MapFeature; layer: MapDocument["layers"][number]; map: MapDocument }[] = [];
  for (const map of maps) {
    for (const layer of map.layers) {
      for (const feature of layer.features) {
        out.push({ feature, layer, map });
      }
    }
  }
  return out;
}

function featureLabel(feature: MapFeature): string {
  if (feature.featureType === "symbol") return feature.designation ?? "";
  if (feature.featureType === "control_measure") return feature.label;
  return feature.label ?? ("name" in feature ? feature.name : "");
}

export function validateScenario(scenario: Scenario): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!scenario.dilemma.statement.trim()) {
    errors.push(
      issue("dilemma_statement_empty", "error", "Dilemma statement is empty. Every scenario needs an identified tension.", "dilemma.statement"),
    );
  }
  if (scenario.dilemma.dependencies.length === 0) {
    errors.push(
      issue("dilemma_dependencies_empty", "error", "Dilemma has no dependencies. Map and reskin checks have nothing to key off.", "dilemma.dependencies"),
    );
  }
  if (!Number.isFinite(scenario.requirement.timeLimitMinutes) || scenario.requirement.timeLimitMinutes <= 0) {
    errors.push(
      issue("time_limit_missing", "error", "Time limit is required. Time pressure is constitutive of the form.", "requirement.timeLimitMinutes"),
    );
  }
  if (scenario.requirement.deliverables.length === 0) {
    errors.push(
      issue("deliverables_empty", "error", "No deliverables. The student does not know what to produce.", "requirement.deliverables"),
    );
  }
  if (!scenario.situation.higherIntentTwoUp.trim()) {
    errors.push(
      issue("higher_intent_two_up_empty", "error", "Two-up intent is required, not optional.", "situation.higherIntentTwoUp"),
    );
  }
  if (scenario.outcomeStates.length < 3) {
    errors.push(
      issue("too_few_outcome_states", "error", "Fewer than 3 outcome states. Insufficient for campaign use.", "outcomeStates"),
    );
  }
  if (!scenario.outcomeStates.some(isTimeExpiredOutcome)) {
    errors.push(
      issue("no_time_expired_outcome", "error", "No time-expired / no-decision outcome state. Indecision is unhandled.", "outcomeStates"),
    );
  }

  const taskOrgIds = allTaskOrgIds(scenario.forces.taskOrg);
  if (scenario.forces.enemyTaskOrg) {
    for (const id of allTaskOrgIds(scenario.forces.enemyTaskOrg)) {
      taskOrgIds.add(id);
    }
  }
  for (const status of scenario.forces.statusOverlay) {
    if (!taskOrgIds.has(status.taskOrgNodeId)) {
      errors.push(
        issue(
          "status_overlay_dangling_ref",
          "error",
          `Status overlay references missing task-org node ${status.taskOrgNodeId}.`,
          `forces.statusOverlay.${status.taskOrgNodeId}`,
        ),
      );
    }
  }

  for (const map of scenario.maps) {
    const scaleOk = map.scaleBar.meters > 0 && map.scaleBar.renderLengthPx > 0;
    const northOk = map.northArrow != null && Number.isFinite(map.northArrow.rotationDeg);
    if (!scaleOk || !northOk) {
      errors.push(
        issue("map_missing_scale_or_north", "error", `Map “${map.name}” is missing a usable scale bar or north arrow.`, `maps.${map.id}`),
      );
    }
    for (const layer of map.layers) {
      const studentVisible = layer.visibleIn.includes("student");
      if (layer.role === "enemy_truth" && studentVisible) {
        errors.push(
          issue("enemy_truth_visible_to_student", "error", "Layer role enemy_truth is visible to the student. Ground truth would leak to the handout.", `maps.${map.id}.layers.${layer.id}`),
        );
      }
      if (layer.role === "solution_overlay" && studentVisible) {
        errors.push(
          issue("solution_overlay_visible_to_student", "error", "Layer role solution_overlay is visible to the student. The solution would leak to the handout.", `maps.${map.id}.layers.${layer.id}`),
        );
      }
    }
  }

  const blob = narrativeBlob(scenario);
  const designations = allDesignations(scenario.forces.taskOrg).filter((d) => d.trim() && d !== "Player force");
  const designationLower = designations.map((d) => d.toLowerCase());

  const unitMentions = new Set<string>();
  for (const match of blob.matchAll(UNIT_PATTERN)) {
    const mention = match[0].replace(/\s+/g, " ").trim();
    if (mention) unitMentions.add(mention);
  }
  for (const mention of unitMentions) {
    const lower = mention.toLowerCase();
    const found = designationLower.some((d) => d.includes(lower) || lower.includes(d));
    if (!found) {
      warnings.push(
        issue("unit_named_but_absent", "warning", `Unit “${mention}” is named in the narrative but is absent from the task organization.`, "forces.taskOrg"),
      );
    }
  }

  for (const { node } of flattenTaskOrg(scenario.forces.taskOrg)) {
    const designation = node.designation.trim();
    if (!designation || designation === "Player force") continue;
    if (!blob.toLowerCase().includes(designation.toLowerCase())) {
      warnings.push(
        issue("unit_never_referenced", "warning", `Unit “${designation}” is in the task organization but never referenced in the narrative.`, `forces.taskOrg.${node.id}`),
      );
    }
  }

  const features = allMapFeatures(scenario.maps);
  const studentFeatureIds = new Set<string>();
  const allFeatureIds = new Set<string>();
  const labels: string[] = [];
  for (const { feature, layer } of features) {
    allFeatureIds.add(feature.id);
    if (layer.visibleIn.includes("student")) studentFeatureIds.add(feature.id);
    const label = featureLabel(feature).trim();
    if (label) labels.push(label);
  }
  const loadBearing = loadBearingFeatureIds(scenario);

  for (const [index, dep] of scenario.dilemma.dependencies.entries()) {
    if (dep.kind === "terrain" && (!dep.mapFeatureRefs || dep.mapFeatureRefs.length === 0)) {
      warnings.push(
        issue("terrain_dep_missing_feature_refs", "warning", "Terrain dependency has no mapFeatureRefs. Dilemma-critical terrain may be invisible.", `dilemma.dependencies.${index}`),
      );
    }
    for (const ref of dep.mapFeatureRefs ?? []) {
      if (!studentFeatureIds.has(ref)) {
        warnings.push(
          issue(
            "map_feature_ref_not_student_visible",
            "warning",
            `Map feature ${ref} is referenced by the dilemma but is not on a student-visible layer.`,
            `dilemma.dependencies.${index}`,
          ),
        );
      }
    }
  }

  if (features.length > 0 && features.every(({ feature }) => loadBearing.has(feature.id))) {
    warnings.push(
      issue("all_features_load_bearing", "warning", "All map features are load-bearing. The map has become a solution key; add non-critical features.", "maps"),
    );
  }

  const situationText = [
    scenario.situation.general,
    scenario.situation.enemy.known,
    scenario.situation.friendly,
    scenario.situation.attachmentsDetachments,
  ].join("\n");
  for (const match of situationText.matchAll(NAMED_FEATURE_PATTERN)) {
    const name = match[0].replace(/\s+/g, " ").trim();
    const found = labels.some((label) => label.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(label.toLowerCase()));
    if (!found) {
      warnings.push(
        issue("situation_names_missing_feature", "warning", `Situation names “${name}” but no map feature carries that label.`, "situation"),
      );
    }
  }

  const confirmedHostile = features.some(
    ({ feature }) =>
      feature.featureType === "symbol" &&
      feature.affiliation === "hostile" &&
      feature.confidence === "confirmed",
  );
  if (confirmedHostile && !scenario.situation.enemy.groundTruth.trim()) {
    warnings.push(
      issue("confirmed_enemy_without_ground_truth", "warning", "An enemy symbol is marked confirmed, but enemy ground truth is empty.", "situation.enemy.groundTruth"),
    );
  }

  if (
    scenario.requirement.timeLimitMinutes > 0 &&
    scenario.meta.estimatedMinutes > 3 * scenario.requirement.timeLimitMinutes
  ) {
    warnings.push(
      issue(
        "estimated_time_too_large",
        "warning",
        `Estimated duration (${scenario.meta.estimatedMinutes} min) is more than 3× the time limit (${scenario.requirement.timeLimitMinutes} min). Scope may be too large for the echelon.`,
        "meta.estimatedMinutes",
      ),
    );
  }

  if (scenario.meta.setting.fictionalized === false) {
    warnings.push(
      issue("not_fictionalized", "warning", "Setting is not fictionalized. Confirm provenance and originality before distribution.", "meta.setting.fictionalized"),
    );
  }

  return { errors, warnings, ok: errors.length === 0 };
}

export function withDerivedLoadBearing(scenario: Scenario): Scenario {
  const ids = loadBearingFeatureIds(scenario);
  return {
    ...scenario,
    maps: scenario.maps.map((map) => ({
      ...map,
      layers: map.layers.map((layer) => ({
        ...layer,
        features: layer.features.map((feature) =>
          feature.featureType === "terrain" ? { ...feature, loadBearing: ids.has(feature.id) } : feature,
        ),
      })),
    })),
  };
}
