# NEXUS AI — Permissions Model

> Every tool declares a permission tier. The engine enforces it. UI shows consent dialogs.

---

## Tiers

| Tier | Name | Behavior | Example tools (future) |
|------|------|----------|------------------------|
| **0** | **Automatic** | No prompt. Safe, read-only, reversible. Logged. | `fs.list`, `fs.read` (allowed folders), `system.getStatus`, `web.search` (read-only) |
| **1** | **Notify** | Executes, but shows toast/log notification. User can cancel next time. | `fs.read` (sensitive folder), `clipboard.read`, `system.openFile` |
| **2** | **Ask** | Must show confirmation dialog with action summary. Requires explicit click. | `fs.write`, `fs.delete`, `system.openApp`, `shell.openExternal` |
| **3** | **Ask with details** | Must show full details: exact command/file, consequences, allowlist scope. Requires explicit consent + optional "remember". | `shell.exec`, `system.installApp`, `network.request` (POST), `fs.write` (outside allowed) |

---

## Rules

1. **Tier is declared in `packages/shared/src/tools.ts` via `PermissionTier` and `permissionTierSchema` (Zod).** Changing a tier is a breaking change.
2. **Engine enforces:** validates input → checks tier → if 2/3, awaits IPC consent response from renderer → only then calls `execute()`.
3. **Never report success without `verify()` passing.** If `verify()` fails, tool result is `ok: false` with diagnostics.
4. **New tools:** add to `docs/PERMISSIONS.md` table and `docs/EVENTS.md` events.
5. **Renderer:** shows tier-appropriate dialog. Tier 0/1 proceed; tier 2/3 block until user approves.

---

## Foundation Phase

No tools registered yet. Single smoke-test IPC `nexus:ping` is tier 0 (automatic).

Future tools will be listed here as they are added, e.g.:

```ts
// packages/shared/src/tools.ts
export const readFileTool: ToolDefinition = {
  name: "fs.readFile",
  description: "Read a file in allowed folders",
  input: z.object({ path: z.string() }),
  permission: PermissionTier.Automatic,
  execute: async ({ path }) => { /* ... */ },
  verify: async ({ path }, output) => { /* ... */ },
};
```

---

## Allowed Folders

- Only folders explicitly configured by the user are accessible.
- Default deny — any tool attempting access outside must be tier 3 (ask with details) and is rejected if not allowlisted.
- Path traversal (e.g., `../`) is normalized and checked before execution.

---

*Last updated: 2026-10-22 — Foundation phase.*
