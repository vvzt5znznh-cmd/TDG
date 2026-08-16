import type { Affiliation, Confidence, ControlMeasure, MapFeature, MilSymbol, TerrainFeature } from "../../schema/types";
import { ECHELON_OPTIONS, echelonFromSidc, functionIdFromSidc, UNIT_CATALOG } from "../../map/sidc";
import { CommitTextInput, Field, NumberInput, Select } from "../fields";

const AFFILIATION_OPTIONS: { value: Affiliation; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "hostile", label: "Hostile" },
  { value: "neutral", label: "Neutral" },
  { value: "unknown", label: "Unknown" },
];

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "suspected", label: "Suspected" },
  { value: "templated", label: "Templated" },
];

export function Inspector({
  feature,
  onPatch,
  onDelete,
}: {
  feature: MapFeature | undefined;
  onPatch: (patch: (Partial<MilSymbol> & { functionId?: string }) | Partial<TerrainFeature> | Partial<ControlMeasure>) => void;
  onDelete: () => void;
}) {
  if (!feature) {
    return (
      <aside className="map-inspector">
        <div className="section-kicker">Inspector</div>
        <p className="hint">Select a unit or a piece of ground. Drag the unit picture from the rail onto the sheet to place it.</p>
      </aside>
    );
  }

  if (feature.featureType === "symbol") {
    const symbol = feature;
    const echelon = symbol.echelon ?? echelonFromSidc(symbol.sidc);
    const kind = functionIdFromSidc(symbol.sidc);
    const kindOptions = UNIT_CATALOG.some((unit) => unit.functionId === kind)
      ? UNIT_CATALOG.map((unit) => ({ value: unit.functionId, label: unit.label }))
      : [{ value: kind, label: kind }, ...UNIT_CATALOG.map((unit) => ({ value: unit.functionId, label: unit.label }))];
    return (
      <aside className="map-inspector">
        <div className="section-kicker">This unit</div>
        <Field label="Designation">
          <CommitTextInput value={symbol.designation ?? ""} onCommit={(designation) => onPatch({ designation })} placeholder="1st Squad" />
        </Field>
        <Field label="Kind">
          <Select value={kind} options={kindOptions} onChange={(functionId) => onPatch({ functionId })} />
        </Field>
        <Field label="Whose">
          <Select value={symbol.affiliation} options={AFFILIATION_OPTIONS} onChange={(affiliation) => onPatch({ affiliation })} />
        </Field>
        <Field label="Echelon">
          <Select value={echelon} options={ECHELON_OPTIONS} onChange={(value) => onPatch({ echelon: value })} />
        </Field>
        <Field label="Known?">
          <Select value={symbol.confidence} options={CONFIDENCE_OPTIONS} onChange={(confidence) => onPatch({ confidence })} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.headquarters)} onChange={(event) => onPatch({ headquarters: event.target.checked })} />
          Headquarters
        </label>
        <label className="row">
          <input type="checkbox" checked={Boolean(symbol.taskForce)} onChange={(event) => onPatch({ taskForce: event.target.checked })} />
          Task force
        </label>
        <Field label="Higher formation">
          <CommitTextInput value={symbol.higherFormation ?? ""} onCommit={(higherFormation) => onPatch({ higherFormation })} placeholder="2. coy" />
        </Field>
        <Field label="Strength">
          <Select
            value={symbol.strengthModifier ?? "none"}
            options={[
              { value: "none", label: "None" },
              { value: "reinforced", label: "Reinforced (+)" },
              { value: "reduced", label: "Reduced (−)" },
            ]}
            onChange={(value) => onPatch({ strengthModifier: value === "none" ? undefined : (value as "reinforced" | "reduced") })}
          />
        </Field>
        <Field label="Size">
          <NumberInput min={20} max={90} value={symbol.sizePx ?? 42} onChange={(sizePx) => onPatch({ sizePx })} />
        </Field>
        <Field label="Rotate symbol" hint="Spin the icon. Drag the handle above it.">
          <NumberInput value={Math.round(symbol.rotationDeg ?? 0)} onChange={(rotationDeg) => onPatch({ rotationDeg })} />
        </Field>
        <Field label="Movement" hint="Speed leader on the symbol. 0 means none — this is not rotation.">
          <NumberInput value={symbol.directionDeg ?? 0} onChange={(directionDeg) => onPatch({ directionDeg })} />
        </Field>
        <p className="hint">{symbol.sidc}</p>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </aside>
    );
  }

  const label = "label" in feature ? feature.label ?? "" : "";
  const kind = "kind" in feature ? feature.kind.replaceAll("_", " ") : feature.featureType;
  return (
    <aside className="map-inspector">
      <div className="section-kicker">{kind}</div>
      <Field label="Label">
        <CommitTextInput value={label} onCommit={(value) => onPatch({ label: value })} />
      </Field>
      <p className="hint">Drag to move. Drag the white corners to reshape.</p>
      <button type="button" className="btn btn-danger" onClick={onDelete}>
        Delete
      </button>
    </aside>
  );
}
