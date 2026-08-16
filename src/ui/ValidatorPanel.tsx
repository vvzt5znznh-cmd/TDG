import type { ValidationResult } from "../validator/validate";

export function ValidatorPanel({ result }: { result: ValidationResult }) {
  return (
    <aside className="panel">
      <div className="section-kicker">Checker</div>
      <h2>{result.ok ? "Ready to print" : "Export blocked"}</h2>
      <p className="hint">Catches omissions. Does not invent content.</p>
      {result.errors.length === 0 && result.warnings.length === 0 ? (
        <p>No issues. Save the file, then print.</p>
      ) : null}
      {result.errors.map((issue) => (
        <div className="issue" key={`${issue.code}-${issue.path}`}>
          <div className="issue-code">error · {issue.code}</div>
          {issue.message}
        </div>
      ))}
      {result.warnings.map((issue) => (
        <div className="issue warn" key={`${issue.code}-${issue.path}`}>
          <div className="issue-code">warning · {issue.code}</div>
          {issue.message}
        </div>
      ))}
    </aside>
  );
}
