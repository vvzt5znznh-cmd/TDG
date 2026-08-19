import { mapImageRef, paperBackgroundSvg } from "../map/mapBase";
import { createScenarioFile } from "../schema/create";
import { newId } from "../schema/ids";
import { buildOutcomeStates } from "../schema/presets";
import type { MissionType, Scenario, TDGFile } from "../schema/types";
import { makeValidScenario } from "../validator/fixtures";

export interface ShippedExample {
  id: string;
  title: string;
  summary: string;
  missionType: MissionType;
  file: TDGFile;
}

function imageRefOf(scenario: Scenario): string {
  const map = scenario.maps[0];
  return (map && mapImageRef(map)) ?? `img_${scenario.id}`;
}

function pack(scenario: Scenario, summary: string): ShippedExample {
  scenario.id = newId();
  const imageRef = imageRefOf(scenario);
  const file = createScenarioFile(scenario, { [imageRef]: paperBackgroundSvg(scenario.title) });
  return {
    id: scenario.id,
    title: scenario.title,
    summary,
    missionType: scenario.meta.missionType,
    file,
  };
}

function retitle(missionType: MissionType, title: string, region: string, patch: (scenario: Scenario) => void): Scenario {
  const scenario = makeValidScenario();
  scenario.title = title;
  scenario.meta.missionType = missionType;
  scenario.meta.setting.region = region;
  scenario.outcomeStates = buildOutcomeStates(missionType);
  patch(scenario);
  return scenario;
}

export const SHIPPED_EXAMPLES: ShippedExample[] = [
  pack(makeValidScenario(), "Two objectives, combat power for one. The swamp canalizes the mounted approach."),
  pack(
    retitle("defense", "Hold the mill at Korsmyr", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "2. plut must hold OBJ WEST long enough for the company to arrive, but 1st Squad and 2nd Squad cannot cover both Route NORTH and the Western swamp dismounted approach.";
      scenario.dilemma.type = "insufficient_combat_power";
      scenario.requirement.role = "You are the commander of 2. plut, occupying a hasty defense at the mill.";
      scenario.requirement.prompt = "What now, platoon commander?";
      scenario.situation.general =
        "2. plut is on OBJ WEST with 1st Squad and 2nd Squad. The Engineer squad is wiring the Western swamp edge. Route NORTH is the enemy’s mounted avenue. East woods masks their dismounts.";
    }),
    "A hasty defense on a crossing. Cover both the road and the swamp, or lose one.",
  ),
  pack(
    retitle("delay", "Buy time on Route NORTH", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "2. plut must delay on Route NORTH for forty minutes, but standing and fighting at OBJ WEST will get 1st Squad and 2nd Squad decisively engaged before the time is bought.";
      scenario.dilemma.type = "risk_vs_tempo";
      scenario.requirement.prompt = "How do you buy the time?";
      scenario.situation.general =
        "2. plut, with 1st Squad, 2nd Squad and the Engineer squad, is south of OBJ WEST. The enemy is expected down Route NORTH. The Western swamp and East woods offer successive positions.";
    }),
    "Time is the commodity. Standing and fighting is not the same as a delay.",
  ),
  pack(
    retitle("raid", "Raid the radio site", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "The radio site beyond East woods can be hit by 2. plut, but extraction back across the Western swamp will collide with the reserve coming down Route NORTH.";
      scenario.dilemma.type = "time_pressure";
      scenario.requirement.prompt = "What now for the raid?";
      scenario.situation.general =
        "2. plut (1st Squad, 2nd Squad, Engineer squad) is south of the Western swamp. A radio site sits behind East woods. OBJ WEST is occupied. Route NORTH is the only fast way out.";
    }),
    "Actions on the objective are the easy part. The swamp is the extraction problem.",
  ),
  pack(
    retitle("convoy_escort", "Convoy through the cut", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "A logistics convoy must use Route NORTH through the cut at OBJ WEST. 2. plut can either clear East woods or escort the column, not both, and the Western swamp hides a dismount threat.";
      scenario.dilemma.type = "resource_allocation";
      scenario.requirement.role = "You command 2. plut, escorting the battalion trains.";
      scenario.requirement.prompt = "How do you get the convoy through?";
      scenario.situation.general =
        "2. plut with 1st Squad, 2nd Squad and the Engineer squad is escorting a six-vehicle convoy onto Route NORTH. OBJ WEST sits in a cut. East woods and the Western swamp both overlook the road.";
    }),
    "The escort cannot be everywhere the ambush could be.",
  ),
  pack(
    retitle("ambush", "Ambush at the gravel pit", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "2. plut can ambush on Route NORTH or cover the Western swamp bypass, not both. 1st Squad and 2nd Squad are enough for one killing zone.";
      scenario.dilemma.type = "insufficient_combat_power";
      scenario.requirement.prompt = "Where do you put the ambush?";
      scenario.situation.general =
        "2. plut (1st Squad, 2nd Squad, Engineer squad) is set near East woods. An enemy column is expected on Route NORTH toward OBJ WEST. A dismounted bypass exists along the Western swamp.";
    }),
    "One killing zone. Two ways around it.",
  ),
  pack(
    retitle("withdrawal", "Break from OBJ WEST", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "2. plut must break from OBJ WEST before the reserve arrives down Route NORTH, but 1st Squad is in contact and the Western swamp will slow anyone who leaves the road.";
      scenario.dilemma.type = "time_pressure";
      scenario.requirement.prompt = "How do you break contact?";
      scenario.situation.general =
        "2. plut is on OBJ WEST. 1st Squad is in contact. 2nd Squad and the Engineer squad are still coherent. Route NORTH is the fast route south. The Western swamp and East woods are slow but covered.";
    }),
    "Getting out is a tactical problem, not an administrative move.",
  ),
  pack(
    retitle("security_screen", "Screen at Storåsen", "Nordic subarctic", (scenario) => {
      scenario.dilemma.statement =
        "2. plut must screen the company along Route NORTH, but a screen that stays intact will not see into East woods, and a screen that looks there will not survive the Western swamp flank.";
      scenario.dilemma.type = "incomplete_information";
      scenario.requirement.prompt = "Where do you put the screen?";
      scenario.situation.general =
        "2. plut with 1st Squad, 2nd Squad and the Engineer squad is to screen south of OBJ WEST. Route NORTH is the mounted approach. East woods and the Western swamp are the places you will not see if you sit on the road.";
    }),
    "Early warning versus staying alive. The screen cannot have both for free.",
  ),
];

export function exampleById(id: string): ShippedExample | undefined {
  return SHIPPED_EXAMPLES.find((item) => item.id === id);
}
