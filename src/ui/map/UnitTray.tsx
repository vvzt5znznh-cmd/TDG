import { useMemo } from "react";
import { buildSidc, ECHELON_OPTIONS, labelForFunctionId, UNIT_CATALOG, UNIT_GROUPS } from "../../map/sidc";
import type { UnitStamp } from "../../map/stamp";
import type { Affiliation, Echelon } from "../../schema/types";
import { newId } from "../../schema/ids";
import { Field, Select, TextInput } from "../fields";
import { SymbolChip } from "./UnitChip";

export interface CustomTrayItem extends UnitStamp {
  id: string;
}

export function UnitTray({
  affiliation,
  onAffiliation,
  defaultEchelon,
  query,
  onQuery,
  draft,
  onDraft,
  customUnits,
  onKeep,
  onRemove,
  onSeed,
}: {
  affiliation: Affiliation;
  onAffiliation: (affiliation: Affiliation) => void;
  defaultEchelon: Echelon;
  query: string;
  onQuery: (query: string) => void;
  draft: UnitStamp;
  onDraft: (draft: UnitStamp) => void;
  customUnits: CustomTrayItem[];
  onKeep: (item: CustomTrayItem) => void;
  onRemove: (id: string) => void;
  onSeed: (stamp: UnitStamp) => void;
}) {
  const stampConfidence = affiliation === "hostile" ? "suspected" : "confirmed";
  const draftEchelon = draft.echelon ?? defaultEchelon;
  const draftSidc = buildSidc({
    affiliation,
    confidence: stampConfidence,
    echelon: draftEchelon,
    functionId: draft.functionId,
    headquarters: draft.headquarters,
    taskForce: draft.taskForce,
  });
  const draftStamp: UnitStamp = {
    ...draft,
    functionId: draft.functionId,
    echelon: draftEchelon,
    designation: draft.designation?.trim() || undefined,
  };
  const draftLabel = draftStamp.designation || labelForFunctionId(draft.functionId);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UNIT_GROUPS;
    return UNIT_GROUPS.map((group) => ({
      ...group,
      units: group.units.filter((unit) => unit.label.toLowerCase().includes(q)),
    })).filter((group) => group.units.length > 0);
  }, [query]);

  return (
    <>
      <div className="section-kicker">Units</div>
      <p className="hint" style={{ marginTop: 0 }}>
        Make one, or pick a premade chip. Drag it onto the sheet.
      </p>
      <Field label="Whose">
        <Select
          value={affiliation}
          options={[
            { value: "friendly", label: "Friendly" },
            { value: "hostile", label: "Hostile" },
            { value: "neutral", label: "Neutral" },
            { value: "unknown", label: "Unknown" },
          ]}
          onChange={onAffiliation}
        />
      </Field>

      <div className="unit-composer">
        <div className="section-kicker">Your unit</div>
        <Field label="Name">
          <TextInput value={draft.designation ?? ""} onChange={(designation) => onDraft({ ...draft, designation })} placeholder="1st Squad" />
        </Field>
        <Field label="Kind">
          <Select
            value={UNIT_CATALOG.some((unit) => unit.functionId === draft.functionId) ? draft.functionId : "UCI"}
            options={UNIT_CATALOG.map((unit) => ({ value: unit.functionId, label: unit.label }))}
            onChange={(functionId) => onDraft({ ...draft, functionId })}
          />
        </Field>
        <Field label="Echelon">
          <Select value={draftEchelon} options={ECHELON_OPTIONS} onChange={(echelon) => onDraft({ ...draft, echelon })} />
        </Field>
        <div className="row">
          <SymbolChip sidc={draftSidc} label={draftLabel} stamp={draftStamp} />
          <button
            type="button"
            className="btn"
            onClick={() =>
              onKeep({
                id: newId(),
                ...draftStamp,
                affiliation,
              })
            }
          >
            Keep
          </button>
        </div>
      </div>

      {customUnits.length > 0 ? (
        <>
          <div className="section-kicker">Yours</div>
          <div className="symbol-palette">
            {customUnits.map((item) => {
              const sidc = buildSidc({
                affiliation: item.affiliation ?? affiliation,
                confidence: (item.affiliation ?? affiliation) === "hostile" ? "suspected" : stampConfidence,
                echelon: item.echelon ?? defaultEchelon,
                functionId: item.functionId,
                headquarters: item.headquarters,
                taskForce: item.taskForce,
              });
              return (
                <div key={item.id} className="unit-tray-slot">
                  <SymbolChip
                    sidc={sidc}
                    label={item.designation || labelForFunctionId(item.functionId)}
                    stamp={{ ...item, affiliation: item.affiliation ?? affiliation }}
                  />
                  <button type="button" className="btn unit-tray-remove" onClick={() => onRemove(item.id)} title="Remove from tray">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <Field label="Premade">
        <TextInput value={query} onChange={onQuery} placeholder="Search infantry, armor…" />
      </Field>
      {filteredGroups.map((group) => (
        <div key={group.id}>
          <div className="section-kicker">{group.label}</div>
          <div className="symbol-palette">
            {group.units.map((unit) => {
              const sidc = buildSidc({
                affiliation,
                confidence: stampConfidence,
                echelon: defaultEchelon,
                functionId: unit.functionId,
              });
              const stamp: UnitStamp = { functionId: unit.functionId };
              return (
                <SymbolChip
                  key={unit.id}
                  sidc={sidc}
                  label={unit.label}
                  stamp={stamp}
                  onSeed={() => onSeed({ functionId: unit.functionId, designation: draft.designation, echelon: draftEchelon })}
                />
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
