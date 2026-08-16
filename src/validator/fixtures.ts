import { createBlankScenario } from "../schema/create";
import { newId } from "../schema/ids";
import type { Layer, Scenario } from "../schema/types";

function layer(scenario: Scenario, role: Layer["role"]): Layer {
  const found = scenario.maps[0]?.layers.find((item) => item.role === role);
  if (!found) throw new Error(`Missing layer ${role}`);
  return found;
}

/** A structurally complete scenario that should pass the validator with no issues. */
export function makeValidScenario(): Scenario {
  const scenario = createBlankScenario({
    title: "Two bridges at Korsmyr",
    missionType: "hasty_attack",
    author: "Example author",
  });

  const swampId = "feat_western_swamp";
  const roadId = "feat_road_north";
  const woodsId = "feat_east_woods";
  const objId = "feat_obj_west";

  const squad1 = newId();
  const squad2 = newId();
  const rootId = scenario.forces.taskOrg.id;

  scenario.dilemma = {
    statement:
      "Two objectives, combat power for one, and the enemy reserve arrives before a sequential approach can clear both.",
    type: "insufficient_combat_power",
    dependencies: [
      {
        kind: "force",
        description: "Dismount strength is insufficient for simultaneous assault on both objectives.",
        capabilityRefs: ["dismountStrength"],
      },
      {
        kind: "fires",
        description: "A single artillery allocation cannot support two axes.",
      },
      {
        kind: "time",
        description: "Enemy reinforcement timeline is shorter than sequential clearance.",
      },
      {
        kind: "terrain",
        description: "The western approach is canalized by the wetland.",
        mapFeatureRefs: [swampId, roadId],
      },
    ],
  };

  scenario.situation = {
    general:
      "2. plut is south of Korsmyr with 1st Squad and 2nd Squad. OBJ WEST sits beyond the Western swamp. Route NORTH is the only hard-topped approach.",
    enemy: {
      known: "A platoon-sized enemy has been reported around OBJ WEST. A suspected reserve is north of Route NORTH.",
      assessedIntent: "Hold the crossings long enough for the reserve to arrive.",
      groundTruth: "A reduced platoon holds OBJ WEST. A company reserve is 20 minutes north of Route NORTH.",
    },
    friendly: "The neighbouring platoon is delayed to the east. Battalion mortars are in priority to 2. plut until H+2.",
    higherMission: "Company seizes the Korsmyr crossings to open the battalion axis.",
    higherIntent: "Gain the crossings before the enemy can reinforce; do not become decisively engaged east of the swamp.",
    higherIntentTwoUp: "Battalion opens the brigade’s northern axis and protects the right flank of the main effort.",
    attachmentsDetachments: "One engineer squad is attached to 2. plut for the crossing.",
    weatherLight: {
      conditions: "Overcast, light rain",
      temperature: "4 C",
      visibility: "2 km",
      sunrise: "06:12",
      sunset: "17:40",
    },
  };

  scenario.forces.taskOrg = {
    id: rootId,
    designation: "2. plut",
    modifier: "reinforced",
    children: [
      { id: squad1, designation: "1st Squad", modifier: "none", children: [] },
      { id: squad2, designation: "2nd Squad", modifier: "none", children: [] },
      { id: newId(), designation: "Engineer squad", modifier: "none", attachedFrom: "Bn Eng", children: [] },
    ],
  };
  scenario.forces.statusOverlay = [
    { taskOrgNodeId: rootId, strength: { assigned: 32, effective: 29 }, ammunition: "adequate", fuel: "full", fatigue: "tired" },
    { taskOrgNodeId: squad1, strength: { assigned: 8, effective: 8 }, ammunition: "full" },
    { taskOrgNodeId: squad2, strength: { assigned: 8, effective: 7 }, ammunition: "adequate", casualties: "1 walking wounded" },
  ];
  scenario.forces.supportingArms = [
    { type: "81mm mortar section DS", availability: "priority of fires until H+2", rounds: "40 HE / 12 smoke" },
  ];

  scenario.requirement = {
    role: "You are the commander of 2. plut.",
    perspective: "You are at the southern edge of the Western swamp, looking north along Route NORTH.",
    prompt: "What now, platoon commander?",
    deliverables: ["frag_order", "sketch", "rationale"],
    timeLimitMinutes: 15,
  };

  scenario.terrain = {
    id: scenario.terrainRef,
    name: "Korsmyr",
    region: "Nordic subarctic",
    gridSystem: "notional",
    extentMeters: 3500,
    effects: {
      observationAndFire: "Long fields of fire along Route NORTH; the Western swamp deadens them to the west.",
      coverAndConcealment: "East woods hide a platoon; the swamp offers concealment but not cover.",
      obstacles: "Western swamp canalizes mounted movement onto Route NORTH.",
      keyTerrain: "The two crossings at OBJ WEST and the bend on Route NORTH.",
      avenuesOfApproach: "Route NORTH is the only hard approach; a dismounted axis exists along the swamp edge.",
      trafficability: "Tracked vehicles stay on the road. Dismounts can cross the swamp slowly.",
      seasonalState: "Thawed myr. Not frozen. Vehicles break through.",
    },
  };

  const terrainLayer = layer(scenario, "terrain");
  const controlLayer = layer(scenario, "control_measures");
  const enemyKnown = layer(scenario, "enemy_known");

  terrainLayer.features = [
    {
      featureType: "terrain",
      id: swampId,
      kind: "wetland",
      geometry: { type: "Polygon", coordinates: [[[200, 400], [500, 400], [500, 700], [200, 700], [200, 400]]] },
      label: "Western swamp",
    },
    {
      featureType: "terrain",
      id: roadId,
      kind: "road",
      geometry: { type: "LineString", coordinates: [[400, 900], [420, 200]] },
      label: "Route NORTH",
    },
    {
      featureType: "terrain",
      id: woodsId,
      kind: "woods",
      geometry: { type: "Polygon", coordinates: [[[900, 300], [1200, 300], [1200, 560], [900, 560], [900, 300]]] },
      label: "East woods",
    },
  ];
  controlLayer.features = [
    {
      featureType: "control_measure",
      id: objId,
      kind: "objective",
      geometry: { type: "Point", coordinates: [380, 280] },
      label: "OBJ WEST",
    },
  ];
  enemyKnown.features = [
    {
      featureType: "symbol",
      id: newId(),
      sidc: "SHGAUCI----D",
      affiliation: "hostile",
      frame: "diamond",
      confidence: "suspected",
      position: { type: "Point", coordinates: [390, 300] },
      designation: "enemy plt",
      echelonMarker: "••",
    },
  ];

  scenario.facilitatorNotes = {
    groundTruth: "The reserve is real and moving. OBJ WEST is held by a reduced platoon with one machine gun covering Route NORTH.",
    discussionPoints: ["Mass vs. sequential attack", "Use of the swamp as an approach"],
    teachingPoints: ["Combat power is a choice, not a stock"],
    commonErrors: ["Splitting squads equally against both objectives"],
    plausibleCOAs: [
      {
        label: "Mass west",
        summary: "Both squads against OBJ WEST; accept the second crossing remaining closed.",
        tradeoffs: "Tempo on one objective; the other stays in enemy hands.",
      },
    ],
  };

  return scenario;
}
