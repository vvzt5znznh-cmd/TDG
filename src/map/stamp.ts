import type { Affiliation, Audience, Echelon, LayerRole, MilSymbol } from "../schema/types";
import { newId } from "../schema/ids";
import { buildSidc, ECHELON_MARKER, frameForAffiliation, withSyncedSidc } from "./sidc";

export interface UnitStamp {
  functionId: string;
  designation?: string;
  echelon?: Echelon;
  headquarters?: boolean;
  taskForce?: boolean;
  affiliation: Affiliation;
}

export function layerRoleForAffiliation(affiliation: Affiliation, audience: Audience | "all"): LayerRole {
  if (affiliation === "hostile") return audience === "facilitator" ? "enemy_truth" : "enemy_known";
  if (affiliation === "neutral") return "neutral";
  if (affiliation === "unknown") return "unknown";
  return "friendly";
}

export function createSymbolFromStamp(
  stamp: UnitStamp,
  point: [number, number],
  defaults?: { echelon?: Echelon },
): MilSymbol {
  const affiliation = stamp.affiliation;
  const confidence: MilSymbol["confidence"] = affiliation === "hostile" ? "suspected" : "confirmed";
  const echelon = stamp.echelon ?? defaults?.echelon ?? "platoon";
  const designation = stamp.designation?.trim() || undefined;
  return withSyncedSidc(
    {
      featureType: "symbol",
      id: newId(),
      affiliation,
      frame: frameForAffiliation(affiliation),
      confidence,
      position: { type: "Point", coordinates: point },
      designation,
      echelon,
      echelonMarker: ECHELON_MARKER[echelon] || undefined,
      headquarters: stamp.headquarters,
      taskForce: stamp.taskForce,
      sizePx: 42,
      sidc: buildSidc({
        affiliation,
        confidence,
        echelon,
        functionId: stamp.functionId,
        headquarters: stamp.headquarters,
        taskForce: stamp.taskForce,
      }),
    },
    stamp.functionId,
  );
}
