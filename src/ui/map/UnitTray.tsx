import { useMemo } from "react";
import { ECHELON_OPTIONS, UNIT_GROUPS } from "../../map/sidc";
import { createSymbolFromStamp, type UnitStamp } from "../../map/stamp";
import { renderSymbol } from "../../map/symbolRender";
import type { Affiliation } from "../../schema/types";
import { Field, Select, TextInput } from "../fields";

const WHOSE: { value: Affiliation; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "hostile", label: "Hostile" },
  { value: "neutral", label: "Neutral" },
  { value: "unknown", label: "Unknown" },
];

export function UnitTray({
  stamp,
  query,
  placing,
  onStamp,
  onQuery,
  onPlacePointerDown,
}: {
  stamp: UnitStamp;
  query: string;
  placing: boolean;
  onStamp: (next: UnitStamp) => void;
  onQuery: (q: string) => void;
  onPlacePointerDown: (e: React.PointerEvent) => void;
}) {
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) return UNIT_GROUPS;
    return UNIT_GROUPS.map((group) => ({
      ...group,
      units: group.units.filter(
        (unit) =>
          unit.label.toLowerCase().includes(q) || unit.functionId.toLowerCase().includes(q),
      ),
    })).filter((group) => group.units.length > 0);
  }, [q]);

  const preview = useMemo(() => createSymbolFromStamp(stamp, [0, 0]), [stamp]);
  const picture = useMemo(() => {
    try {
      return renderSymbol(preview);
    } catch {
      return null;
    }
  }, [preview]);

  return (
    <aside className="unit-tray" aria-label="Units">
      <div className="section-kicker">Unit</div>
      <p className="hint unit-tray-lead">
        This is one milsymbol. Whose, icon, echelon, and name are on it. Drag the picture onto the
        sheet.
      </p>

      <div className="unit-composer">
        <div
          className={`unit-preview${placing ? " is-placing" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Drag this unit onto the map"
          onPointerDown={onPlacePointerDown}
        >
          {picture ? (
            <img src={picture.href} alt="" width={picture.width} height={picture.height} draggable={false} />
          ) : null}
        </div>

        <Field label="Whose">
          <Select
            value={stamp.affiliation}
            options={WHOSE}
            onChange={(affiliation) => onStamp({ ...stamp, affiliation })}
          />
        </Field>
        <Field label="Name">
          <TextInput
            value={stamp.designation ?? ""}
            placeholder="1st Squad"
            onChange={(designation) => onStamp({ ...stamp, designation })}
          />
        </Field>
        <Field label="Echelon">
          <Select
            value={stamp.echelon ?? "platoon"}
            options={ECHELON_OPTIONS}
            onChange={(echelon) => onStamp({ ...stamp, echelon })}
          />
        </Field>
      </div>

      <Field label="Main icon">
        <TextInput value={query} placeholder="Search infantry, recon…" onChange={onQuery} />
      </Field>
      {groups.map((group) => (
        <div key={group.id} className="unit-icon-group">
          <div className="section-kicker">{group.label}</div>
          <ul className="unit-list">
            {group.units.map((unit) => (
              <li key={unit.functionId}>
                <button
                  type="button"
                  className={`unit-template${unit.functionId === stamp.functionId ? " is-current" : ""}`}
                  onClick={() => onStamp({ ...stamp, functionId: unit.functionId })}
                >
                  {unit.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
