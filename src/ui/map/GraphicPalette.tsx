import { useMemo, useState } from "react";
import { GRAPHIC_DEFS, graphicThumbnail, type GraphicDef, type GraphicGroup } from "../../map/milstd";
import type { ControlMeasureKind } from "../../schema/types";
import { useMilStdReady } from "./useMilStd";

const GROUP_LABELS: Record<GraphicGroup, string> = {
  "tasks-action": "Actions",
  "tasks-effect": "Effects on the enemy",
  "tasks-security": "Security and fires",
  maneuver: "Maneuver",
  areas: "Areas",
  fires: "Fires",
};

const GROUP_ORDER: GraphicGroup[] = ["tasks-action", "tasks-effect", "tasks-security", "maneuver", "areas", "fires"];

function GraphicCard({
  def,
  active,
  onPointerDown,
}: {
  def: GraphicDef;
  active: boolean;
  onPointerDown: (def: GraphicDef, e: React.PointerEvent) => void;
}) {
  const ready = useMilStdReady();
  const thumb = useMemo(() => (ready ? graphicThumbnail(def.kind) : null), [ready, def.kind]);
  return (
    <button
      type="button"
      className={`graphic-card${active ? " is-active" : ""}`}
      title={`${def.label} — ${def.hint} Drag onto the sheet, or click then click the sheet.`}
      onPointerDown={(e) => onPointerDown(def, e)}
    >
      <span className="graphic-card-art">
        {thumb ? <img src={thumb.href} alt="" draggable={false} /> : <span className="graphic-card-loading">…</span>}
      </span>
      <span className="graphic-card-name">{def.label}</span>
    </button>
  );
}

export function GraphicPalette({
  activeKind,
  onCardPointerDown,
}: {
  activeKind: ControlMeasureKind | null;
  onCardPointerDown: (def: GraphicDef, e: React.PointerEvent) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? GRAPHIC_DEFS.filter((def) => def.label.toLowerCase().includes(q) || def.kind.includes(q)) : GRAPHIC_DEFS;

  return (
    <div className="graphic-palette">
      <input
        type="text"
        value={query}
        placeholder="Search graphics…"
        onChange={(e) => setQuery(e.target.value)}
      />
      {GROUP_ORDER.map((group) => {
        const defs = matches.filter((def) => def.group === group);
        if (defs.length === 0) return null;
        return (
          <div key={group} className="dock-subgroup">
            <div className="section-kicker">{GROUP_LABELS[group]}</div>
            <div className="graphic-grid">
              {defs.map((def) => (
                <GraphicCard key={def.kind} def={def} active={activeKind === def.kind} onPointerDown={onCardPointerDown} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
