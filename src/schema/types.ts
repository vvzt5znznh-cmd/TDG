export type Echelon =
  | "fireteam"
  | "squad"
  | "platoon"
  | "company"
  | "battalion"
  | "brigade"
  | "custom";

export type Domain =
  | "ground"
  | "air"
  | "naval"
  | "logistics"
  | "combined"
  | "civilian_emergency"
  | "other";

export type MissionType =
  | "deliberate_attack"
  | "hasty_attack"
  | "defense"
  | "delay"
  | "movement_to_contact"
  | "raid"
  | "ambush"
  | "withdrawal"
  | "river_crossing"
  | "security_screen"
  | "convoy_escort"
  | "custom";

export type DilemmaType =
  | "insufficient_combat_power"
  | "time_pressure"
  | "risk_vs_tempo"
  | "incomplete_information"
  | "conflicting_intent"
  | "resource_allocation"
  | "rules_of_engagement"
  | "command_relationship"
  | "custom";

export type DependencyKind =
  | "force"
  | "terrain"
  | "time"
  | "information"
  | "fires"
  | "logistics"
  | "civil"
  | "weather";

export type SupplyLevel = "full" | "adequate" | "low" | "black";
export type FatigueLevel = "fresh" | "tired" | "exhausted";
export type TaskOrgModifier = "reinforced" | "reduced" | "none";
export type Affiliation = "friendly" | "hostile" | "neutral" | "unknown";
export type SymbolFrame = "rectangle" | "diamond" | "square" | "cloverleaf" | "custom";
export type Confidence = "confirmed" | "suspected" | "templated";
export type GridSystem = "MGRS" | "notional" | "none";
export type Audience = "student" | "facilitator";
export type FileType = "scenario" | "campaign" | "library";

export type LayerRole =
  | "terrain"
  | "control_measures"
  | "friendly"
  | "enemy_known"
  | "enemy_truth"
  | "neutral"
  | "unknown"
  | "labels"
  | "solution_overlay"
  | "outcome_overlay";

export type TerrainFeatureKind =
  | "contour"
  | "spot_elevation"
  | "mountain"
  | "woods"
  | "water"
  | "river"
  | "stream"
  | "wetland"
  | "built_up"
  | "building"
  | "road"
  | "trail"
  | "bridge"
  | "custom";

export type ControlMeasureKind =
  | "boundary"
  | "phase_line"
  | "objective"
  | "axis_of_advance"
  | "engagement_area"
  | "battle_position"
  | "trp"
  | "lz"
  | "checkpoint"
  | "obstacle"
  | MissionTaskKind
  | "custom";

/** FM 3-90-1 tactical mission tasks drawn as overlay graphics. */
export type MissionTaskKind =
  | "seize"
  | "clear"
  | "fix"
  | "block"
  | "breach"
  | "bypass"
  | "canalize"
  | "penetrate"
  | "turn"
  | "disrupt"
  | "destroy"
  | "neutralize"
  | "contain"
  | "isolate"
  | "occupy"
  | "retain"
  | "secure"
  | "ambush"
  | "attack_by_fire"
  | "support_by_fire"
  | "suppress"
  | "screen"
  | "guard"
  | "cover";

export type Deliverable =
  | "frag_order"
  | "sketch"
  | "rationale"
  | "task_organization"
  | "priority_of_work"
  | "fire_support_plan"
  | "custom";

export type Mobility =
  | "dismounted"
  | "motorized"
  | "mechanized"
  | "armored"
  | "air_assault";

export type Position = [number, number] | [number, number, number];

export interface Point {
  type: "Point";
  coordinates: Position;
}

export interface LineString {
  type: "LineString";
  coordinates: Position[];
}

export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
}

export type GeoGeometry = Point | LineString | Polygon;

export interface ScenarioMeta {
  echelon: Echelon;
  missionType: MissionType;
  domain: Domain;
  setting: {
    era: string;
    region: string;
    season: string;
    fictionalized: boolean;
  };
  estimatedMinutes: number;
  author: string;
  provenance?: string;
  tags: string[];
}

export type CapabilityKey = keyof CapabilityProfile;

export interface CapabilityProfile {
  dismountStrength?: number;
  directFire: string[];
  antiArmor: string[];
  organicIndirect: string[];
  mobility: Mobility;
  comms?: string;
  sustainmentRadius?: string;
  nightCapability?: string;
}

export interface Dependency {
  kind: DependencyKind;
  description: string;
  mapFeatureRefs?: string[];
  capabilityRefs?: CapabilityKey[];
}

export interface Dilemma {
  statement: string;
  type: DilemmaType;
  dependencies: Dependency[];
}

export interface EnemyPicture {
  known: string;
  assessedIntent: string;
  groundTruth: string;
}

export interface WeatherLight {
  bmnt?: string;
  sunrise?: string;
  sunset?: string;
  eent?: string;
  moonIllumination?: string;
  conditions: string;
  temperature?: string;
  visibility?: string;
}

export interface Situation {
  general: string;
  enemy: EnemyPicture;
  friendly: string;
  higherMission: string;
  higherIntent: string;
  higherIntentTwoUp: string;
  attachmentsDetachments: string;
  civilConsiderations?: string;
  weatherLight: WeatherLight;
}

export interface TaskOrgNode {
  id: string;
  templateNodeRef?: string;
  designation: string;
  modifier: TaskOrgModifier;
  attachedFrom?: string;
  children: TaskOrgNode[];
}

export interface UnitStatus {
  taskOrgNodeId: string;
  strength: { assigned: number; effective: number };
  ammunition: SupplyLevel;
  fuel?: SupplyLevel;
  fatigue?: FatigueLevel;
  casualties?: string;
  notes?: string;
}

export interface SupportAsset {
  type: string;
  availability: string;
  constraints?: string;
  rounds?: string;
}

export interface ForceAllocation {
  playerForceRef: string;
  taskOrg: TaskOrgNode;
  statusOverlay: UnitStatus[];
  supportingArms: SupportAsset[];
  enemyForceRef?: string;
  enemyTaskOrg?: TaskOrgNode;
}

export interface TemplateNode {
  id: string;
  designation: string;
  children: TemplateNode[];
  equipment?: string;
}

export interface ForceTemplate {
  id: string;
  name: string;
  nation: string;
  era: string;
  echelon: Echelon;
  root: TemplateNode;
  capabilities: CapabilityProfile;
}

export interface TerrainEffects {
  observationAndFire: string;
  coverAndConcealment: string;
  obstacles: string;
  keyTerrain: string;
  avenuesOfApproach: string;
  trafficability: string;
  seasonalState: string;
}

export interface Terrain {
  id: string;
  name: string;
  region: string;
  gridSystem: GridSystem;
  extentMeters: number;
  effects: TerrainEffects;
  baseMapRef?: string;
}

export interface LegendEntry {
  id: string;
  label: string;
  swatch?: string;
}

export interface RenderSpec {
  kind: "hatch" | "stipple" | "solid" | "custom";
  density?: number;
  color?: string;
  svgPattern?: string;
}

export interface FillPattern {
  id: string;
  name: string;
  render: RenderSpec;
  legendLabel: string;
}

export interface AnnotationSetItem {
  id: string;
  name: string;
  render: RenderSpec;
}

export interface AnnotationSet {
  domain: Domain;
  items: AnnotationSetItem[];
}

export interface TerrainFeature {
  featureType: "terrain";
  id: string;
  kind: TerrainFeatureKind;
  geometry: GeoGeometry;
  fillPatternId?: string;
  label?: string;
  elevation?: number;
  /** Derived at validate/render time from dilemma mapFeatureRefs. */
  loadBearing?: boolean;
}

export interface MilSymbol {
  featureType: "symbol";
  id: string;
  sidc?: string;
  affiliation: Affiliation;
  frame: SymbolFrame;
  echelonMarker?: string;
  confidence: Confidence;
  position: Point;
  designation?: string;
  strengthModifier?: "reinforced" | "reduced";
  rotationDeg?: number;
  /** milsymbol frame height in map pixels. */
  sizePx?: number;
  /** Movement indicator, degrees clockwise from north. */
  directionDeg?: number;
  higherFormation?: string;
  staffComments?: string;
  headquarters?: boolean;
  taskForce?: boolean;
  /** APP-6 echelon; kept in sync with SIDC position 12. */
  echelon?: Echelon;
}

export interface ControlMeasure {
  featureType: "control_measure";
  id: string;
  kind: ControlMeasureKind;
  geometry: GeoGeometry;
  label: string;
}

export interface Annotation {
  featureType: "annotation";
  id: string;
  name: string;
  geometry: GeoGeometry;
  label?: string;
}

export type MapFeature = TerrainFeature | MilSymbol | ControlMeasure | Annotation;

export interface Layer {
  id: string;
  role: LayerRole;
  visibleIn: Audience[];
  features: MapFeature[];
}

export type BaseLayer =
  | { kind: "raster"; imageRef: string; opacity: number }
  | { kind: "vector"; features: TerrainFeature[] };

/** Optional tracing image under the vector ground (paper, sketch, or uploaded map). */
export interface MapUnderlay {
  imageRef: string;
  opacity: number;
}

export interface MapDocument {
  id: string;
  name: string;
  scaleBar: { meters: number; renderLengthPx: number };
  northArrow: { rotationDeg: number };
  /** Vector ground is the editable map. Raster `base` is legacy; the editor promotes it. */
  base: BaseLayer;
  underlay?: MapUnderlay;
  layers: Layer[];
  legend: { autoGenerate: boolean; manualEntries?: LegendEntry[] };
}

export interface Requirement {
  role: string;
  perspective: string;
  prompt: string;
  deliverables: Deliverable[];
  timeLimitMinutes: number;
}

export interface StateDelta {
  unitStatusChanges: UnitStatus[];
  terrainControlChanges?: { featureId: string; controlledBy: string }[];
  timeElapsedMinutes: number;
  newInformation: string[];
  enemyStateChanges: string;
}

export interface OutcomeState {
  id: string;
  label: string;
  description: string;
  stateDelta: StateDelta;
  overlayLayerId?: string;
  discussionHook?: string;
  /** Additive marker so the time-expired outcome can be found after label edits. */
  kind?: "time_expired" | "standard";
}

export interface PlausibleCOA {
  label: string;
  summary: string;
  tradeoffs: string;
}

export interface FacilitatorNotes {
  groundTruth: string;
  discussionPoints: string[];
  teachingPoints: string[];
  commonErrors: string[];
  plausibleCOAs: PlausibleCOA[];
  historicalBasis?: string;
}

export interface Scenario {
  id: string;
  title: string;
  revision: number;
  meta: ScenarioMeta;
  dilemma: Dilemma;
  situation: Situation;
  forces: ForceAllocation;
  terrainRef: string;
  /** Embedded so a scenario file is self-contained without a library. */
  terrain?: Terrain;
  maps: MapDocument[];
  requirement: Requirement;
  outcomeStates: OutcomeState[];
  facilitatorNotes: FacilitatorNotes;
  variantOf?: string;
}

export interface CampaignNode {
  id: string;
  scenarioRef: string;
  preconditions: { kind: string; description: string }[];
  transitions: { fromOutcomeStateId: string; toNodeId: string | "END" }[];
}

export interface Campaign {
  id: string;
  title: string;
  initialState: StateDelta;
  nodes: CampaignNode[];
}

export interface Library {
  id: string;
  name: string;
  forceTemplates: ForceTemplate[];
  terrains: Terrain[];
  fillPatterns: FillPattern[];
  annotationSets: AnnotationSet[];
}

export interface TDGFile {
  schemaVersion: string;
  fileType: FileType;
  generator: { app: string; version: string };
  created: string;
  modified: string;
  content: Scenario | Campaign | Library;
  assets?: Record<string, string>;
  /** Internal: unknown top-level keys, written back at the file root. */
  unknownKeys?: Record<string, unknown>;
}

export function isScenario(content: TDGFile["content"]): content is Scenario {
  return "dilemma" in content && "situation" in content;
}

export function isCampaign(content: TDGFile["content"]): content is Campaign {
  return "nodes" in content && "initialState" in content;
}

export function isLibrary(content: TDGFile["content"]): content is Library {
  return "forceTemplates" in content && "terrains" in content;
}
