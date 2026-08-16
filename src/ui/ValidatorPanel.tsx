import type { ValidationResult } from "../validator/validate";

export function ValidatorPanel({ result, compact }: { result: ValidationResult; compact?: boolean }) {
  if (compact) {
    if (result.ok) {
      return <span className="check-pill ok">Ready to print</span>;
    }
    const needed = result.errors.slice(0, 3).map((issue) => issue.message.split(".")[0]).join(" · ");
    return (
      <span className="check-pill" title={result.errors.map((issue) => issue.message).join("\n")}>
        {result.errors.length} to print{needed ? `: ${needed}` : ""}
      </span>
    );
  }
  return (
    <aside className="panel">
      <div className="section-kicker">Checker</div>
      <h2>{result.ok ? "Ready to print" : "Export blocked"}</h2>
      {result.errors.map((issue) => (
        <div className="issue" key={`${issue.code}-${issue.path}`}>
          {issue.message}
        </div>
      ))}
      {result.warnings.map((issue) => (
        <div className="issue warn" key={`${issue.code}-${issue.path}`}>
          {issue.message}
        </div>
      ))}
    </aside>
  );
}
