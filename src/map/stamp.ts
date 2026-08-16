import type { Affiliation, Audience, Echelon, LayerRole, MilSymbol } from "../schema/types";
import { newId } from "../schema/ids";
import { buildSidc, ECHELON_MARKER, frameForAffiliation, withSyncedSidc } from "./sidc";

export interface UnitStamp {
  functionId: string;
  designation?: string;
  echelon?: Echelon;
  headquarters?: boolean;
  taskForce?: boolean;
  affiliation?: Affiliation;
}

export function parseUnitStamp(raw: string): UnitStamp | null {
  try {
    const value = JSON.parse(raw) as Partial<UnitStamp>;
    if (!value || typeof value.functionId !== "string") return null;
    const functionId = value.functionId.replaceAll("-", "").trim();
    if (functionId.length < 2) return null;
    const designation = value.designation?.trim();
    return {
      functionId,
      designation: designation || undefined,
      echelon: value.echelon,
      headquarters: value.headquarters,
      taskForce: value.taskForce,
      affiliation: value.affiliation,
    };
  } catch {
    return null;
  }
}

export function stampFromDataTransfer(data: DataTransfer | null): UnitStamp | null {
  if (!data) return null;
  const raw = data.getData("application/json") || data.getData("text/plain");
  return raw ? parseUnitStamp(raw) : null;
}

export function writeStampTransfer(data: DataTransfer, stamp: UnitStamp) {
  const raw = JSON.stringify(stamp);
  data.setData("application/json", raw);
  data.setData("text/plain", raw);
  data.effectAllowed = "copy";
}

export function layerRoleForAffiliation(affiliation: Affiliation, audience: Audience | "all"): LayerRole {
  if (affiliation === "hostile") return audience === "facilitator" ? "enemy_truth" : "enemy_known";
  return "friendly";
}

export function createSymbolFromStamp(
  stamp: UnitStamp,
  point: [number, number],
  defaults: { affiliation: Affiliation; echelon: Echelon },
): MilSymbol {
  const affiliation = stamp.affiliation ?? defaults.affiliation;
  const confidence: MilSymbol["confidence"] = affiliation === "hostile" ? "suspected" : "confirmed";
  const echelon = stamp.echelon ?? defaults.echelon;
  return withSyncedSidc(
    {
      featureType: "symbol",
      id: newId(),
      affiliation,
      frame: frameForAffiliation(affiliation),
      confidence,
      position: { type: "Point", coordinates: point },
      designation: stamp.designation,
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
