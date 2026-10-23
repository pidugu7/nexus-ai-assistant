import { CoreWithFallback } from "../core/CoreScene.js";

export function CenterCore() {
  return (
    <section className="core" data-testid="center-core" style={{ width: "100%", height: "100%", minHeight: 380, display: "flex", flexDirection: "column" }}>
      <CoreWithFallback />
    </section>
  );
}
