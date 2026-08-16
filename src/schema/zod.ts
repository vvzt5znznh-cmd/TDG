import { z } from "zod";
import type { TaskOrgNode, TDGFile, TemplateNode } from "./types";

const positionSchema = z.union([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
]);

export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: positionSchema,
});

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(positionSchema).min(2),
});

export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(positionSchema).min(4)),
});

export const geometrySchema = z.discriminatedUnion("type", [
  pointSchema,
  lineStringSchema,
  polygonSchema,
]);

const echelonSchema = z.enum([
  "fireteam",
  "squad",
  "platoon",
  "company",
  "battalion",
  "brigade",
  "custom",
]);

const domainSchema = z.enum([
  "ground",
  "air",
  "naval",
  "logistics",
  "combined",
  "civilian_emergency",
  "other",
]);

const missionTypeSchema = z.enum([
  "deliberate_attack",
  "hasty_attack",
  "defense",
  "delay",
  "movement_to_contact",
  "raid",
  "ambush",
  "withdrawal",
  "river_crossing",
  "security_screen",
  "convoy_escort",
  "custom",
]);

const dilemmaTypeSchema = z.enum([
  "insufficient_combat_power",
  "time_pressure",
  "risk_vs_tempo",
  "incomplete_information",
  "conflicting_intent",
  "resource_allocation",
  "rules_of_engagement",
  "command_relationship",
  "custom",
]);

const dependencyKindSchema = z.enum([
  "force",
  "terrain",
  "time",
  "information",
  "fires",
  "logistics",
  "civil",
  "weather",
]);

const capabilityKeySchema = z.enum([
  "dismountStrength",
  "directFire",
  "antiArmor",
  "organicIndirect",
  "mobility",
  "comms",
  "sustainmentRadius",
  "nightCapability",
]);

const supplyLevelSchema = z.enum(["full", "adequate", "low", "black"]);
const fatigueSchema = z.enum(["fresh", "tired", "exhausted"]);
const modifierSchema = z.enum(["reinforced", "reduced", "none"]);
const affiliationSchema = z.enum(["friendly", "hostile", "neutral", "unknown"]);
const frameSchema = z.enum(["rectangle", "diamond", "square", "cloverleaf", "custom"]);
const confidenceSchema = z.enum(["confirmed", "suspected", "templated"]);
const audienceSchema = z.enum(["student", "facilitator"]);
const layerRoleSchema = z.enum([
  "terrain",
  "control_measures",
  "friendly",
  "enemy_known",
  "enemy_truth",
  "labels",
  "solution_overlay",
  "outcome_overlay",
]);
const terrainKindSchema = z.enum([
  "contour",
  "spot_elevation",
  "woods",
  "water",
  "wetland",
  "built_up",
  "road",
  "trail",
  "bridge",
  "custom",
]);
const controlKindSchema = z.enum([
  "boundary",
  "phase_line",
  "objective",
  "axis_of_advance",
  "engagement_area",
  "battle_position",
  "trp",
  "lz",
  "checkpoint",
  "obstacle",
  "custom",
]);
const deliverableSchema = z.enum([
  "frag_order",
  "sketch",
  "rationale",
  "task_organization",
  "priority_of_work",
  "fire_support_plan",
  "custom",
]);
const mobilitySchema = z.enum([
  "dismounted",
  "motorized",
  "mechanized",
  "armored",
  "air_assault",
]);
const gridSystemSchema = z.enum(["MGRS", "notional", "none"]);

export const unitStatusSchema = z.object({
  taskOrgNodeId: z.string(),
  strength: z.object({
    assigned: z.number(),
    effective: z.number(),
  }),
  ammunition: supplyLevelSchema,
  fuel: supplyLevelSchema.optional(),
  fatigue: fatigueSchema.optional(),
  casualties: z.string().optional(),
  notes: z.string().optional(),
});

export const taskOrgNodeSchema: z.ZodType<TaskOrgNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    templateNodeRef: z.string().optional(),
    designation: z.string(),
    modifier: modifierSchema,
    attachedFrom: z.string().optional(),
    children: z.array(taskOrgNodeSchema),
  }),
);

const supportAssetSchema = z.object({
  type: z.string(),
  availability: z.string(),
  constraints: z.string().optional(),
  rounds: z.string().optional(),
});

const forceAllocationSchema = z.object({
  playerForceRef: z.string(),
  taskOrg: taskOrgNodeSchema,
  statusOverlay: z.array(unitStatusSchema),
  supportingArms: z.array(supportAssetSchema),
  enemyForceRef: z.string().optional(),
  enemyTaskOrg: taskOrgNodeSchema.optional(),
});

const dependencySchema = z.object({
  kind: dependencyKindSchema,
  description: z.string(),
  mapFeatureRefs: z.array(z.string()).optional(),
  capabilityRefs: z.array(capabilityKeySchema).optional(),
});

const dilemmaSchema = z.object({
  statement: z.string(),
  type: dilemmaTypeSchema,
  dependencies: z.array(dependencySchema),
});

const weatherLightSchema = z.object({
  bmnt: z.string().optional(),
  sunrise: z.string().optional(),
  sunset: z.string().optional(),
  eent: z.string().optional(),
  moonIllumination: z.string().optional(),
  conditions: z.string(),
  temperature: z.string().optional(),
  visibility: z.string().optional(),
});

const situationSchema = z.object({
  general: z.string(),
  enemy: z.object({
    known: z.string(),
    assessedIntent: z.string(),
    groundTruth: z.string(),
  }),
  friendly: z.string(),
  higherMission: z.string(),
  higherIntent: z.string(),
  higherIntentTwoUp: z.string(),
  attachmentsDetachments: z.string(),
  civilConsiderations: z.string().optional(),
  weatherLight: weatherLightSchema,
});

const metaSchema = z.object({
  echelon: echelonSchema,
  missionType: missionTypeSchema,
  domain: domainSchema,
  setting: z.object({
    era: z.string(),
    region: z.string(),
    season: z.string(),
    fictionalized: z.boolean(),
  }),
  estimatedMinutes: z.number(),
  author: z.string(),
  provenance: z.string().optional(),
  tags: z.array(z.string()),
});

export const terrainEffectsSchema = z.object({
  observationAndFire: z.string(),
  coverAndConcealment: z.string(),
  obstacles: z.string(),
  keyTerrain: z.string(),
  avenuesOfApproach: z.string(),
  trafficability: z.string(),
  seasonalState: z.string(),
});

export const terrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  gridSystem: gridSystemSchema,
  extentMeters: z.number(),
  effects: terrainEffectsSchema,
  baseMapRef: z.string().optional(),
});

const terrainFeatureSchema = z.object({
  featureType: z.literal("terrain"),
  id: z.string(),
  kind: terrainKindSchema,
  geometry: geometrySchema,
  fillPatternId: z.string().optional(),
  label: z.string().optional(),
  elevation: z.number().optional(),
  loadBearing: z.boolean().optional(),
});

const milSymbolSchema = z.object({
  featureType: z.literal("symbol"),
  id: z.string(),
  sidc: z.string().optional(),
  affiliation: affiliationSchema,
  frame: frameSchema,
  echelonMarker: z.string().optional(),
  confidence: confidenceSchema,
  position: pointSchema,
  designation: z.string().optional(),
  strengthModifier: z.enum(["reinforced", "reduced"]).optional(),
  rotationDeg: z.number().optional(),
});

const controlMeasureSchema = z.object({
  featureType: z.literal("control_measure"),
  id: z.string(),
  kind: controlKindSchema,
  geometry: geometrySchema,
  label: z.string(),
});

const annotationSchema = z.object({
  featureType: z.literal("annotation"),
  id: z.string(),
  name: z.string(),
  geometry: geometrySchema,
  label: z.string().optional(),
});

export const mapFeatureSchema = z.discriminatedUnion("featureType", [
  terrainFeatureSchema,
  milSymbolSchema,
  controlMeasureSchema,
  annotationSchema,
]);

const layerSchema = z.object({
  id: z.string(),
  role: layerRoleSchema,
  visibleIn: z.array(audienceSchema),
  features: z.array(mapFeatureSchema),
});

const baseLayerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("raster"),
    imageRef: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal("vector"),
    features: z.array(terrainFeatureSchema),
  }),
]);

export const mapUnderlaySchema = z.object({
  imageRef: z.string(),
  opacity: z.number().min(0).max(1),
});

export const mapDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  scaleBar: z.object({
    meters: z.number(),
    renderLengthPx: z.number(),
  }),
  northArrow: z.object({
    rotationDeg: z.number(),
  }),
  base: baseLayerSchema,
  underlay: mapUnderlaySchema.optional(),
  layers: z.array(layerSchema),
  legend: z.object({
    autoGenerate: z.boolean(),
    manualEntries: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          swatch: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const stateDeltaSchema = z.object({
  unitStatusChanges: z.array(unitStatusSchema),
  terrainControlChanges: z
    .array(
      z.object({
        featureId: z.string(),
        controlledBy: z.string(),
      }),
    )
    .optional(),
  timeElapsedMinutes: z.number(),
  newInformation: z.array(z.string()),
  enemyStateChanges: z.string(),
});

export const outcomeStateSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  stateDelta: stateDeltaSchema,
  overlayLayerId: z.string().optional(),
  discussionHook: z.string().optional(),
  kind: z.enum(["time_expired", "standard"]).optional(),
});

const requirementSchema = z.object({
  role: z.string(),
  perspective: z.string(),
  prompt: z.string(),
  deliverables: z.array(deliverableSchema),
  timeLimitMinutes: z.number(),
});

const facilitatorNotesSchema = z.object({
  groundTruth: z.string(),
  discussionPoints: z.array(z.string()),
  teachingPoints: z.array(z.string()),
  commonErrors: z.array(z.string()),
  plausibleCOAs: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      tradeoffs: z.string(),
    }),
  ),
  historicalBasis: z.string().optional(),
});

export const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  revision: z.number(),
  meta: metaSchema,
  dilemma: dilemmaSchema,
  situation: situationSchema,
  forces: forceAllocationSchema,
  terrainRef: z.string(),
  terrain: terrainSchema.optional(),
  maps: z.array(mapDocumentSchema),
  requirement: requirementSchema,
  outcomeStates: z.array(outcomeStateSchema),
  facilitatorNotes: facilitatorNotesSchema,
  variantOf: z.string().optional(),
});

const campaignNodeSchema = z.object({
  id: z.string(),
  scenarioRef: z.string(),
  preconditions: z.array(
    z.object({
      kind: z.string(),
      description: z.string(),
    }),
  ),
  transitions: z.array(
    z.object({
      fromOutcomeStateId: z.string(),
      toNodeId: z.union([z.string(), z.literal("END")]),
    }),
  ),
});

export const campaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  initialState: stateDeltaSchema,
  nodes: z.array(campaignNodeSchema),
});

const templateNodeSchema: z.ZodType<TemplateNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    designation: z.string(),
    children: z.array(templateNodeSchema),
    equipment: z.string().optional(),
  }),
);

const capabilityProfileSchema = z.object({
  dismountStrength: z.number().optional(),
  directFire: z.array(z.string()),
  antiArmor: z.array(z.string()),
  organicIndirect: z.array(z.string()),
  mobility: mobilitySchema,
  comms: z.string().optional(),
  sustainmentRadius: z.string().optional(),
  nightCapability: z.string().optional(),
});

const forceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  nation: z.string(),
  era: z.string(),
  echelon: echelonSchema,
  root: templateNodeSchema,
  capabilities: capabilityProfileSchema,
});

const renderSpecSchema = z.object({
  kind: z.enum(["hatch", "stipple", "solid", "custom"]),
  density: z.number().optional(),
  color: z.string().optional(),
  svgPattern: z.string().optional(),
});

export const librarySchema = z.object({
  id: z.string(),
  name: z.string(),
  forceTemplates: z.array(forceTemplateSchema),
  terrains: z.array(terrainSchema),
  fillPatterns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      render: renderSpecSchema,
      legendLabel: z.string(),
    }),
  ),
  annotationSets: z.array(
    z.object({
      domain: domainSchema,
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          render: renderSpecSchema,
        }),
      ),
    }),
  ),
});

const contentSchema = z.union([scenarioSchema, campaignSchema, librarySchema]);

export const tdgFileBodySchema = z.object({
  schemaVersion: z.string(),
  fileType: z.enum(["scenario", "campaign", "library"]),
  generator: z.object({
    app: z.string(),
    version: z.string(),
  }),
  created: z.string(),
  modified: z.string(),
  content: contentSchema,
  assets: z.record(z.string(), z.string()).optional(),
});

export function parseFileBody(raw: unknown): z.infer<typeof tdgFileBodySchema> {
  return tdgFileBodySchema.parse(raw);
}

export type ParsedTDGFileBody = z.infer<typeof tdgFileBodySchema>;

export function assertTDGFile(file: ParsedTDGFileBody): TDGFile {
  return file as TDGFile;
}
