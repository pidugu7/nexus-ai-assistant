import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "shared",
      include: ["packages/shared/tests/**/*.test.ts"],
      environment: "node",
    },
  },
]);
