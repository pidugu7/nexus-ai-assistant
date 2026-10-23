import { useState } from "react";
import { submitCommand } from "../lib/command.js";
import { useLogStore } from "../store/logStore.js";

export function CommandBar() {
  const [text, setText] = useState("");
  const addEntry = useLogStore((s) => s.addEntry);

  const onSubmit = () => {
    const result = submitCommand(text);
    // Log via store (real app entry) — also console for main
    addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
      timestamp: new Date().toISOString(),
      level: "info",
      message: result.message,
    });
    console.log(`[NEXUS] ${result.message}`);
    setText("");
  };

  return (
    <div className="commandbar" data-testid="commandbar">
      <input
        className="command-input font-mono"
        aria-label="Command input"
        placeholder="Enter command…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        data-testid="command-input"
      />
      <button
        className="mic-btn"
        disabled
        aria-disabled="true"
        title="Voice arrives in Phase 7"
        data-testid="mic-button"
        type="button"
      >
        🎤
      </button>
    </div>
  );
}
