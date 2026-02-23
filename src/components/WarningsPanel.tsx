import { ImportWarning } from "../types/model";

interface Props {
  warnings: ImportWarning[];
}

export function WarningsPanel({ warnings }: Props) {
  if (warnings.length === 0) {
    return (
      <div className="glass-panel warning-panel">
        <h2>Warnings</h2>
        <div className="muted">No warnings.</div>
      </div>
    );
  }

  return (
    <div className="glass-panel warning-panel">
      <h2>Warnings</h2>
      <ul>
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`}>
            <strong>{warning.code}</strong>: {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
