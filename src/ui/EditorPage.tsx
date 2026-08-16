import { useState } from "react";
import { MapEditor } from "./map/MapEditor";
import { ValidatorPanel } from "./ValidatorPanel";
import { PacketView } from "./write/PacketView";
import { WriteView } from "./write/WriteView";
import { useDocument } from "../store/document";
import { useScenario } from "../store/hooks";
import { validateScenario } from "../validator/validate";

const TABS = [
  { id: "write", label: "Write" },
  { id: "map", label: "Map" },
  { id: "packet", label: "Packet" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function EditorPage() {
  const scenario = useScenario();
  const updateScenario = useDocument((state) => state.updateScenario);
  const assets = useDocument((state) => state.file.assets);
  const setAsset = useDocument((state) => state.setAsset);
  const [tab, setTab] = useState<TabId>("write");
  const result = scenario ? validateScenario(scenario) : { ok: false, errors: [], warnings: [] };

  if (!scenario) {
    return (
      <div className="main">
        <p>This file is not a scenario.</p>
      </div>
    );
  }

  return (
    <div className={`editor-shell ${tab === "map" ? "map-tab" : ""}`}>
      <div className="editor-tabs">
        {TABS.map((item) => (
          <button type="button" key={item.id} className={item.id === tab ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
        <ValidatorPanel result={result} compact />
      </div>
      <div className={tab === "map" ? "map-main" : "main"}>
        {tab === "write" ? <WriteView scenario={scenario} onChange={(next) => updateScenario(() => next)} /> : null}
        {tab === "map" ? (
          <MapEditor scenario={scenario} assets={assets} onChange={(next) => updateScenario(() => next)} onAsset={setAsset} />
        ) : null}
        {tab === "packet" ? <PacketView scenario={scenario} onChange={(next) => updateScenario(() => next)} /> : null}
      </div>
    </div>
  );
}
