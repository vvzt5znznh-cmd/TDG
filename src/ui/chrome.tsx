import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { isScenario } from "../schema/types";
import { useDocument } from "../store/document";
import { validateScenario } from "../validator/validate";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const file = useDocument((state) => state.file);
  const fileName = useDocument((state) => state.fileName);
  const dirty = useDocument((state) => state.dirty);
  const cacheOnly = useDocument((state) => state.cacheOnly);
  const loadError = useDocument((state) => state.loadError);
  const save = useDocument((state) => state.save);
  const saveAs = useDocument((state) => state.saveAs);
  const openFromDisk = useDocument((state) => state.openFromDisk);
  const printing = location.pathname.startsWith("/print");
  const scenario = isScenario(file.content) ? file.content : null;
  const validation = scenario ? validateScenario(scenario) : { ok: false, errors: [], warnings: [] };

  return (
    <div className="app-shell">
      <div className="masthead">
        <span>Training material</span>
        <strong>TDG Builder</strong>
        <span style={{ textAlign: "right" }}>Unclassified</span>
      </div>
      {!printing && (
        <>
          <header className="topbar">
            <Link className="brand" to="/">
              TDG Builder
            </Link>
            <div className="file-meta">
              <div>
                {scenario?.title || "Untitled"} {dirty ? <span className="dirty">• unsaved</span> : null}
              </div>
              <div>
                {fileName ?? "no file on disk"}
                {cacheOnly ? " · cache only" : ""}
              </div>
            </div>
            <div className="topbar-actions">
              <NavLink className="btn" to="/">
                Library
              </NavLink>
              <NavLink className="btn" to="/edit">
                Editor
              </NavLink>
              <button type="button" className="btn" onClick={() => void openFromDisk()}>
                Open
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save()}>
                Save
              </button>
          <button type="button" className="btn" onClick={() => void saveAs()}>
            Save as
          </button>
              <button
                type="button"
                className="btn"
                disabled={!validation.ok}
                onClick={() => navigate("/print/student")}
                title={validation.ok ? "Student handout" : "Fix export errors first"}
              >
                Print student
              </button>
              <button
                type="button"
                className="btn"
                disabled={!validation.ok}
                onClick={() => navigate("/print/facilitator")}
                title={validation.ok ? "Facilitator packet" : "Fix export errors first"}
              >
                Print facilitator
              </button>
            </div>
          </header>
          <div className={`status-line ${cacheOnly || dirty ? "warn" : ""}`}>
            {loadError ? `${loadError} — ` : ""}
            {dirty ? "Unsaved. " : ""}
            {fileName ? fileName : "No file yet — Save creates one. Cache is not the file."}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
