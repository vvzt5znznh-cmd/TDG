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

/** Simple notional sketch used as the default raster base. */
export function notionalBaseMapSvg(title = "Notional terrain"): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <rect width="1600" height="1200" fill="#e7e2d1"/>
  <rect x="24" y="24" width="1552" height="1152" fill="none" stroke="#3d4a32" stroke-width="4"/>
  <path d="M80 820 C 280 760, 420 900, 640 840 S 980 700, 1220 760 S 1480 900, 1540 820" fill="none" stroke="#6a7d4e" stroke-width="18" opacity="0.55"/>
  <path d="M120 200 C 300 140, 480 260, 700 180 S 1100 80, 1480 160" fill="none" stroke="#8aa070" stroke-width="10" opacity="0.4"/>
  <ellipse cx="420" cy="640" rx="210" ry="120" fill="#9bb7a0" opacity="0.55"/>
  <ellipse cx="1080" cy="420" rx="180" ry="140" fill="#6f8f62" opacity="0.45"/>
  <ellipse cx="1180" cy="480" rx="90" ry="70" fill="#5d7a52" opacity="0.4"/>
  <path d="M80 980 L 420 860 L 780 900 L 1120 780 L 1520 820" fill="none" stroke="#6b5344" stroke-width="8"/>
  <path d="M780 900 L 860 200" fill="none" stroke="#6b5344" stroke-width="5"/>
  <circle cx="860" cy="200" r="10" fill="#6b5344"/>
  <text x="80" y="70" font-family="Georgia, serif" font-size="28" fill="#3d4a32">${escapeXml(title)}</text>
  <text x="80" y="1120" font-family="Georgia, serif" font-size="18" fill="#5a5a4a">Schematic — not to be used as a solution key</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    base: { kind: "raster", imageRef, opacity: 1 },
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
      dependencies: [],
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
  const imageRef =
    scenario.maps[0]?.base.kind === "raster" ? scenario.maps[0].base.imageRef : `img_${newId()}`;
  const defaultAssets = assets ?? { [imageRef]: notionalBaseMapSvg(scenario.title) };
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
