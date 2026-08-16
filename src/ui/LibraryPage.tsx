import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SHIPPED_EXAMPLES } from "../examples";
import { listRecent, loadRecent, type RecentRecord } from "../io/cache";
import { MISSION_TYPE_LABELS } from "../schema/presets";
import type { MissionType } from "../schema/types";
import { duplicateScenarioFile } from "../schema/create";
import { useDocument } from "../store/document";
import { Select } from "./fields";

export function LibraryPage() {
  const navigate = useNavigate();
  const newScenario = useDocument((state) => state.newScenario);
  const loadFromFile = useDocument((state) => state.loadFromFile);
  const openFromDisk = useDocument((state) => state.openFromDisk);
  const [missionType, setMissionType] = useState<MissionType>("hasty_attack");
  const [recent, setRecent] = useState<RecentRecord[]>([]);

  useEffect(() => {
    void listRecent().then(setRecent).catch(() => setRecent([]));
  }, []);

  return (
    <div className="library">
      <div className="library-hero">
        <div className="kicker">Local-first authoring</div>
        <h1>Tactical Decision Games, on paper.</h1>
        <p>
          One authoring pass. Two documents: a student handout and a facilitator packet. No accounts, no server, no
          score. Save a <code>.tdg.json</code> file — that file is the scenario.
        </p>
        <div className="row">
          <Select
            value={missionType}
            options={(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map((value) => ({
              value,
              label: MISSION_TYPE_LABELS[value],
            }))}
            onChange={setMissionType}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              newScenario(missionType);
              navigate("/edit");
            }}
          >
            New scenario
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void openFromDisk().then((opened) => {
                if (opened) navigate("/edit");
              });
            }}
          >
            Open file
          </button>
        </div>
        <p className="hint">The browser cache is a convenience, not a substitute for Save.</p>
      </div>

      <h2>Shipped examples</h2>
      <p className="hint">Original fictionalized scenarios. Opening one makes a copy you can save as your own file.</p>
      <div className="example-grid">
        {SHIPPED_EXAMPLES.map((example) => (
          <button
            type="button"
            className="example-card"
            key={example.id}
            onClick={() => {
              loadFromFile(duplicateScenarioFile(example.file), null, null);
              navigate("/edit");
            }}
          >
            <div className="kicker">{MISSION_TYPE_LABELS[example.missionType]}</div>
            <h3>{example.title}</h3>
            <p>{example.summary}</p>
          </button>
        ))}
      </div>

      {recent.length > 0 ? (
        <>
          <h2 style={{ marginTop: 28 }}>Local cache</h2>
          <p className="hint">Recent drafts stored in this browser. Not the file. Use Open or Save.</p>
          <div className="example-grid">
            {recent.map((item) => (
              <button
                type="button"
                className="example-card"
                key={item.id}
                onClick={() => {
                  void loadRecent(item.id).then((file) => {
                    if (!file) return;
                    loadFromFile(file, item.fileName, null);
                    navigate("/edit");
                  });
                }}
              >
                <div className="kicker">{item.fileName ?? "cache"}</div>
                <h3>{item.title}</h3>
                <p>{new Date(item.modified).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
