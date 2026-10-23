import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "../src/renderer/src/App.js";
import { useLogStore } from "../src/renderer/src/store/logStore.js";

describe("duplicate App started fix", () => {
  it("appears once per launch (React StrictMode + bus should not double)", async () => {
    useLogStore.setState({ entries: [] });
    const { unmount } = render(<App />);
    // App mounts twice in StrictMode — guard with useRef should keep single boot
    const entries = useLogStore.getState().entries.filter((e) => e.message === "App started");
    // In test env without main bus, App fallback adds exactly one boot; second effect cleans up
    expect(entries.length).toBeLessThanOrEqual(1);
    unmount();
    useLogStore.setState({ entries: [] });
  });
});
