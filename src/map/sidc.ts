import type { Affiliation, Confidence, Echelon } from "../schema/types";

export interface UnitCatalogEntry {
  id: string;
  label: string;
  functionId: string;
}

export interface UnitCatalogGroup {
  id: string;
  label: string;
  units: readonly UnitCatalogEntry[];
}

/** 2525C/APP-6 letter SIDC function IDs, as accepted by milsymbol. */
export const UNIT_GROUPS: readonly UnitCatalogGroup[] = [
  {
    id: "combat",
    label: "Combat",
    units: [
      { id: "infantry", label: "Infantry", functionId: "UCI" },
      { id: "armor", label: "Armor", functionId: "UCA" },
      { id: "recon", label: "Recon", functionId: "UCR" },
      { id: "cavalry", label: "Cavalry", functionId: "UCV" },
    ],
  },
  {
    id: "fires",
    label: "Fires",
    units: [
      { id: "artillery", label: "Artillery", functionId: "UCF" },
      { id: "mortars", label: "Mortars", functionId: "UCM" },
      { id: "air_defense", label: "Air defense", functionId: "UCD" },
    ],
  },
  {
    id: "support",
    label: "Support",
    units: [
      { id: "engineers", label: "Engineers", functionId: "UCE" },
      { id: "signals", label: "Signals", functionId: "UCS" },
      { id: "medical", label: "Medical", functionId: "USM" },
      { id: "supply", label: "Supply", functionId: "US-" },
      { id: "admin", label: "Admin", functionId: "USA" },
    ],
  },
  {
    id: "c2",
    label: "C2",
    units: [{ id: "headquarters", label: "HQ unit", functionId: "UH-" }],
  },
] as const;

export const UNIT_CATALOG: readonly UnitCatalogEntry[] = UNIT_GROUPS.flatMap((group) => [...group.units]);

export type UnitCatalogId = (typeof UNIT_CATALOG)[number]["id"];

const AFFILIATION_CHAR: Record<Affiliation, string> = {
  friendly: "F",
  hostile: "H",
  neutral: "N",
  unknown: "U",
};

const STATUS_CHAR: Record<Confidence, string> = {
  confirmed: "P",
  suspected: "A",
  templated: "A",
};

const ECHELON_CHAR: Record<Echelon, string> = {
  fireteam: "A",
  squad: "B",
  platoon: "D",
  company: "E",
  battalion: "F",
  brigade: "H",
  custom: "D",
};

export const ECHELON_MARKER: Record<Echelon, string> = {
  fireteam: "ø",
  squad: "•",
  platoon: "••",
  company: "|",
  battalion: "||",
  brigade: "| | |",
  custom: "",
};

/** 12-character letter SIDC. Position 11 is HQ/TF, 12 is echelon. */
export function buildSidc(options: {
  affiliation: Affiliation;
  confidence: Confidence;
  echelon: Echelon;
  functionId: string;
  headquarters?: boolean;
  taskForce?: boolean;
}): string {
  const fn = (options.functionId.replaceAll("-", "") + "---").slice(0, 3);
  const modifier = options.headquarters && options.taskForce ? "B" : options.headquarters ? "A" : options.taskForce ? "E" : "-";
  return `S${AFFILIATION_CHAR[options.affiliation]}G${STATUS_CHAR[options.confidence]}${fn}---${modifier}${ECHELON_CHAR[options.echelon]}`;
}

export function frameForAffiliation(affiliation: Affiliation): "rectangle" | "diamond" | "square" | "cloverleaf" {
  if (affiliation === "hostile") return "diamond";
  if (affiliation === "neutral") return "square";
  if (affiliation === "unknown") return "cloverleaf";
  return "rectangle";
}
