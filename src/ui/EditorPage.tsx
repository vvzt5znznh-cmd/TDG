import { useState } from "react";
import { DilemmaForm, MetaForm, NotesForm, OutcomesForm, RequirementForm, SituationForm, TerrainForm } from "./forms";
import { TaskOrgEditor } from "./forces";
import { MapEditor } from "./map/MapEditor";
import { ValidatorPanel } from "./ValidatorPanel";
import type { Scenario } from "../schema/types";
import { useDocument } from "../store/document";
import { useScenario } from "../store/hooks";
import { validateScenario } from "../validator/validate";

const SECTIONS = [
  { id: "meta", label: "Meta" },
  { id: "dilemma", label: "Dilemma" },
  { id: "situation", label: "Situation" },
  { id: "forces", label: "Forces" },
  { id: "terrain", label: "Terrain" },
  { id: "map", label: "Map" },
  { id: "requirement", label: "Requirement" },
  { id: "outcomes", label: "Outcomes" },
  { id: "notes", label: "Facilitator notes" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function SectionBody({
  id,
  scenario,
  onChange,
}: {
  id: SectionId;
  scenario: Scenario;
  onChange: (scenario: Scenario) => void;
}) {
  const assets = useDocument((state) => state.file.assets);
  const setAsset = useDocument((state) => state.setAsset);
  switch (id) {
    case "meta":
      return <MetaForm scenario={scenario} onChange={onChange} />;
    case "dilemma":
      return <DilemmaForm scenario={scenario} onChange={onChange} />;
    case "situation":
      return <SituationForm scenario={scenario} onChange={onChange} />;
    case "forces":
      return <TaskOrgEditor scenario={scenario} onChange={onChange} />;
    case "terrain":
      return <TerrainForm scenario={scenario} onChange={onChange} />;
    case "map":
      return <MapEditor scenario={scenario} assets={assets} onChange={onChange} onAsset={setAsset} />;
    case "requirement":
      return <RequirementForm scenario={scenario} onChange={onChange} />;
    case "outcomes":
      return <OutcomesForm scenario={scenario} onChange={onChange} />;
    case "notes":
      return <NotesForm scenario={scenario} onChange={onChange} />;
  }
}

export function EditorPage() {
  const scenario = useScenario();
  const updateScenario = useDocument((state) => state.updateScenario);
  const duplicate = useDocument((state) => state.duplicate);
  const [section, setSection] = useState<SectionId>("meta");
  const result = scenario ? validateScenario(scenario) : { ok: false, errors: [], warnings: [] };

  if (!scenario) {
    return (
      <div className="main">
        <p>This file is not a scenario. v1 opens scenario files only.</p>
      </div>
    );
  }

  return (
    <div className="layout">
      <nav className="sidenav">
        {SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === section ? "active" : ""}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" onClick={() => duplicate()}>
          Duplicate
        </button>
      </nav>
      <div className="main">
        <SectionBody id={section} scenario={scenario} onChange={(next) => updateScenario(() => next)} />
      </div>
      <ValidatorPanel result={result} />
    </div>
  );
}
