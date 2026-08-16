import type { MissionType, OutcomeState } from "./types";
import { TIME_EXPIRED_DESCRIPTION, TIME_EXPIRED_LABEL } from "./constants";
import { newId } from "./ids";

export interface OutcomePreset {
  label: string;
  description: string;
}

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  deliberate_attack: "Deliberate attack",
  hasty_attack: "Hasty attack",
  defense: "Defense",
  delay: "Delay",
  movement_to_contact: "Movement to contact",
  raid: "Raid",
  ambush: "Ambush",
  withdrawal: "Withdrawal",
  river_crossing: "River crossing",
  security_screen: "Security / screen",
  convoy_escort: "Convoy escort",
  custom: "Custom",
};

const PRESETS: Record<MissionType, OutcomePreset[]> = {
  deliberate_attack: [
    { label: "Objective seized, combat-effective", description: "The force seizes the objective and remains able to continue the fight." },
    { label: "Seized but culminated", description: "The objective is taken, but the force is spent and cannot exploit." },
    { label: "Repulsed, forced onto defense", description: "The attack fails and the force is forced to defend in contact." },
    { label: "Bypassed, enemy in place", description: "The force bypasses; the enemy remains in position on the original objective." },
  ],
  hasty_attack: [
    { label: "Momentum maintained", description: "The hasty attack carries through and the force keeps tempo." },
    { label: "Attack stalled, force fixed", description: "The attack stalls; the force is fixed and losing initiative." },
    { label: "Repulsed with losses", description: "The attack is thrown back with significant casualties." },
  ],
  defense: [
    { label: "Position held", description: "The defensive position holds; the enemy does not achieve a penetration." },
    { label: "Penetrated but sealed", description: "The enemy penetrates locally but the breach is sealed." },
    { label: "Penetrated, forced to withdraw", description: "The position is broken and the force must withdraw." },
    { label: "Enveloped and cut off", description: "The force is enveloped and no longer has a viable withdrawal route." },
  ],
  delay: [
    { label: "Time bought, force intact", description: "Required time is bought without destroying the delaying force." },
    { label: "Time bought at cost", description: "Time is bought, but the force is badly attrited." },
    { label: "Force decisively engaged", description: "The delay turns into a decisive engagement the force cannot break." },
    { label: "Withdrew early, time not bought", description: "The force pulls off before the required time is gained." },
  ],
  movement_to_contact: [
    { label: "Contact developed on favorable terms", description: "Contact is made where the force can fight on its own terms." },
    { label: "Meeting engagement, both disrupted", description: "Both sides collide and lose cohesion." },
    { label: "Lead element fixed", description: "The lead element is fixed; the rest of the force is not yet in the fight." },
    { label: "Enemy avoided contact", description: "The enemy slips the movement and contact is not developed." },
  ],
  raid: [
    { label: "Objective achieved, clean extraction", description: "Actions on the objective succeed and the force extracts cleanly." },
    { label: "Achieved, extraction contested", description: "The objective is achieved but extraction is under pressure." },
    { label: "Aborted before actions on objective", description: "The raid is aborted before actions on the objective." },
    { label: "Committed and unable to extract", description: "The force is committed on the objective and cannot extract." },
  ],
  ambush: [
    { label: "Killing zone effective, clean break", description: "The ambush fires effectively and the force breaks contact cleanly." },
    { label: "Partial engagement, enemy escaped", description: "Only part of the enemy is engaged; the rest escapes." },
    { label: "Ambush compromised early", description: "The ambush is discovered before initiation." },
    { label: "Ambush turned", description: "The enemy turns the ambush and the force is counterattacked." },
  ],
  withdrawal: [
    { label: "Clean break, force intact", description: "The force breaks contact and withdraws intact." },
    { label: "Break achieved at cost", description: "The force gets out, but not without significant loss." },
    { label: "Rearguard decisively engaged", description: "The rearguard is decisively engaged and cannot disengage." },
    { label: "Withdrawal became a rout", description: "Cohesion collapses and the withdrawal becomes a rout." },
  ],
  river_crossing: [
    { label: "Crossing established and expanded", description: "A crossing is established and the far-bank foothold is expanded." },
    { label: "Bridgehead established but contained", description: "A bridgehead exists but is contained and cannot expand." },
    { label: "Crossing failed, force split", description: "The crossing fails with elements isolated on both banks." },
  ],
  security_screen: [
    { label: "Early warning provided, force preserved", description: "The screen provides warning and remains a viable force." },
    { label: "Warning provided, screen destroyed", description: "Warning is passed, but the screen is destroyed doing it." },
    { label: "Penetrated undetected", description: "The enemy penetrates the screen without effective warning." },
  ],
  convoy_escort: [
    { label: "Convoy through, minimal loss", description: "The convoy reaches its destination with minimal loss." },
    { label: "Through with significant loss", description: "The convoy gets through, but with significant loss to escort or cargo." },
    { label: "Convoy halted and defending", description: "The convoy is halted and forced to defend in place." },
  ],
  custom: [
    { label: "Favorable outcome", description: "The force achieves the intent of the requirement." },
    { label: "Partial success", description: "Some aims are met; others are not, and cost is paid." },
    { label: "Unfavorable outcome", description: "The force fails to achieve the intent." },
  ],
};

export function outcomePresetsFor(missionType: MissionType): OutcomePreset[] {
  return PRESETS[missionType];
}

function emptyDelta() {
  return {
    unitStatusChanges: [],
    timeElapsedMinutes: 0,
    newInformation: [] as string[],
    enemyStateChanges: "",
  };
}

export function buildOutcomeStates(missionType: MissionType): OutcomeState[] {
  const presets = outcomePresetsFor(missionType).map((preset) => ({
    id: newId(),
    label: preset.label,
    description: preset.description,
    stateDelta: emptyDelta(),
    kind: "standard" as const,
  }));

  presets.push({
    id: newId(),
    label: TIME_EXPIRED_LABEL,
    description: TIME_EXPIRED_DESCRIPTION,
    stateDelta: {
      ...emptyDelta(),
      timeElapsedMinutes: 0,
      enemyStateChanges: "Enemy timeline continues unopposed.",
    },
    kind: "time_expired",
  });

  return presets;
}

export function isTimeExpiredOutcome(state: OutcomeState): boolean {
  if (state.kind === "time_expired") return true;
  const label = state.label.toLowerCase();
  return (
    label.includes("no decision") ||
    (label.includes("time") && (label.includes("expired") || label.includes("limit")))
  );
}
