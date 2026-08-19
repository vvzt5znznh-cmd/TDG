import { mapImageRef, paperBackgroundSvg } from "../map/mapBase";
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from "./constants";
import { newId, nowIso } from "./ids";
import { buildOutcomeStates } from "./presets";
import type {
  Audience,
  Layer,
  LayerRole,
  MapDocument,
  MissionType,
  Scenario,
  TDGFile,
  Terrain,
} from "./types";

export const DEFAULT_LAYER_ROLES: { role: LayerRole; visibleIn: Audience[]; name?: string }[] = [
  { role: "terrain", visibleIn: ["student", "facilitator"] },
  { role: "control_measures", visibleIn: ["student", "facilitator"] },
  { role: "friendly", visibleIn: ["student", "facilitator"] },
  { role: "enemy_known", visibleIn: ["student", "facilitator"] },
  { role: "enemy_truth", visibleIn: ["facilitator"] },
  { role: "neutral", visibleIn: ["student", "facilitator"] },
  { role: "unknown", visibleIn: ["student", "facilitator"] },
  { role: "labels", visibleIn: ["student", "facilitator"] },
  { role: "solution_overlay", visibleIn: ["facilitator"] },
];

export function defaultLayers(): Layer[] {
  return DEFAULT_LAYER_ROLES.map(({ role, visibleIn }) => ({
    id: newId(),
    role,
    visibleIn: [...visibleIn],
    features: [],
  }));
}

/** Blank paper underlay. Ground is drawn as editable vector features, not baked into this image. */
export function notionalBaseMapSvg(title = "Notional terrain"): string {
  return paperBackgroundSvg(title);
}

export function createTerrain(partial?: Partial<Terrain>): Terrain {
  return {
    id: partial?.id ?? newId(),
    name: partial?.name ?? "Notional ground",
    region: partial?.region ?? "Nordic subarctic",
    gridSystem: partial?.gridSystem ?? "notional",
    extentMeters: partial?.extentMeters ?? 4000,
    effects: partial?.effects ?? {
      observationAndFire: "",
      coverAndConcealment: "",
      obstacles: "",
      keyTerrain: "",
      avenuesOfApproach: "",
      trafficability: "",
      seasonalState: "",
    },
    baseMapRef: partial?.baseMapRef,
  };
}

export function createMapDocument(imageRef: string, name = "Situation overlay"): MapDocument {
  return {
    id: newId(),
    name,
    scaleBar: { meters: 500, renderLengthPx: 160 },
    northArrow: { rotationDeg: 0 },
    base: { kind: "vector", features: [] },
    underlay: { imageRef, opacity: 1 },
    layers: defaultLayers(),
    legend: { autoGenerate: true },
  };
}

export interface CreateScenarioOptions {
  title?: string;
  missionType?: MissionType;
  author?: string;
}

export function createBlankScenario(options: CreateScenarioOptions = {}): Scenario {
  const missionType = options.missionType ?? "hasty_attack";
  const terrain = createTerrain();
  const imageRef = `img_${newId()}`;
  const map = createMapDocument(imageRef);
  const rootId = newId();

  return {
    id: newId(),
    title: options.title ?? "Untitled scenario",
    revision: 1,
    meta: {
      echelon: "platoon",
      missionType,
      domain: "ground",
      setting: {
        era: "contemporary",
        region: "Nordic subarctic",
        season: "late autumn",
        fictionalized: true,
      },
      estimatedMinutes: 30,
      author: options.author ?? "",
      tags: [],
    },
    dilemma: {
      statement: "",
      type: "insufficient_combat_power",
      dependencies: [{ kind: "force", description: "" }],
    },
    situation: {
      general: "",
      enemy: { known: "", assessedIntent: "", groundTruth: "" },
      friendly: "",
      higherMission: "",
      higherIntent: "",
      higherIntentTwoUp: "",
      attachmentsDetachments: "",
      weatherLight: { conditions: "" },
    },
    forces: {
      playerForceRef: "",
      taskOrg: {
        id: rootId,
        designation: "Player force",
        modifier: "none",
        children: [],
      },
      statusOverlay: [
        {
          taskOrgNodeId: rootId,
          strength: { assigned: 0, effective: 0 },
          ammunition: "full",
        },
      ],
      supportingArms: [],
    },
    terrainRef: terrain.id,
    terrain,
    maps: [map],
    requirement: {
      role: "",
      perspective: "",
      prompt: "What now?",
      deliverables: ["frag_order", "sketch", "rationale"],
      timeLimitMinutes: 15,
    },
    outcomeStates: buildOutcomeStates(missionType),
    facilitatorNotes: {
      groundTruth: "",
      discussionPoints: [],
      teachingPoints: [],
      commonErrors: [],
      plausibleCOAs: [],
    },
  };
}

export function createScenarioFile(scenario: Scenario, assets?: Record<string, string>): TDGFile {
  const timestamp = nowIso();
  const imageRef = (scenario.maps[0] && mapImageRef(scenario.maps[0])) ?? `img_${newId()}`;
  const defaultAssets = assets ?? { [imageRef]: paperBackgroundSvg(scenario.title) };
  return {
    schemaVersion: SCHEMA_VERSION,
    fileType: "scenario",
    generator: { app: APP_NAME, version: APP_VERSION },
    created: timestamp,
    modified: timestamp,
    content: scenario,
    assets: defaultAssets,
  };
}

export function createNewFile(options: CreateScenarioOptions = {}): TDGFile {
  return createScenarioFile(createBlankScenario(options));
}

export function duplicateScenarioFile(file: TDGFile): TDGFile {
  const timestamp = nowIso();
  if (!("dilemma" in file.content)) {
    throw new Error("Only scenario files can be duplicated");
  }
  const scenario = file.content;
  return {
    ...file,
    created: timestamp,
    modified: timestamp,
    generator: { app: APP_NAME, version: APP_VERSION },
    content: {
      ...scenario,
      id: newId(),
      title: scenario.title.startsWith("Copy of ") ? scenario.title : `Copy of ${scenario.title}`,
      revision: 1,
      variantOf: undefined,
    },
  };
}
