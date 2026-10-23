const rows = [
  { label: "CPU", value: "—" },
  { label: "GPU", value: "—" },
  { label: "RAM", value: "—" },
  { label: "NETWORK", value: "—" },
] as const;

export function RightPanel() {
  return (
    <aside className="rightpanel" data-testid="right-panel">
      <h2 className="panel-title">SYSTEM STATUS</h2>
      <div className="panel-rows">
        {rows.map((r) => (
          <div key={r.label} className="panel-row">
            <span className="panel-label">{r.label}</span>
            <span className="panel-value text-muted font-mono" aria-label={`${r.label} not connected`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="panel-task">
        <span className="panel-label">ACTIVE TASK:</span>
        <span className="panel-value">None</span>
      </div>
    </aside>
  );
}
