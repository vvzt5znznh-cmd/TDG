import type { Affiliation, Confidence, Echelon } from "../schema/types";

/** 2525C/APP-6 letter SIDC, 12 characters, as accepted by milsymbol. */
export const UNIT_CATALOG = [
  { id: "infantry", label: "Infantry", functionId: "UCI" },
  { id: "armor", label: "Armor", functionId: "UCA" },
  { id: "recon", label: "Recon", functionId: "UCR" },
  { id: "engineers", label: "Engineers", functionId: "UCE" },
  { id: "artillery", label: "Artillery", functionId: "UCF" },
  { id: "mortars", label: "Mortars", functionId: "UCM" },
  { id: "air_defense", label: "Air defense", functionId: "UCD" },
  { id: "headquarters", label: "HQ", functionId: "UH-" },
  { id: "supply", label: "Supply", functionId: "US-" },
] as const;

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

export function buildSidc(options: {
  affiliation: Affiliation;
  confidence: Confidence;
  echelon: Echelon;
  functionId: string;
}): string {
  const fn = (options.functionId.replaceAll("-", "") + "---").slice(0, 3);
  return `S${AFFILIATION_CHAR[options.affiliation]}G${STATUS_CHAR[options.confidence]}${fn}----${ECHELON_CHAR[options.echelon]}`;
}

export function frameForAffiliation(affiliation: Affiliation): "rectangle" | "diamond" | "square" | "cloverleaf" {
  if (affiliation === "hostile") return "diamond";
  if (affiliation === "neutral") return "square";
  if (affiliation === "unknown") return "cloverleaf";
  return "rectangle";
}
