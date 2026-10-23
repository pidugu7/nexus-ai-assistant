import { z } from "zod";

/**
 * Tool contract for NEXUS AI.
 * Every tool must satisfy this shape. The LLM can only call registered tools.
 */

export const PermissionTier = {
  Automatic: 0,
  Notify: 1,
  Ask: 2,
  AskWithDetails: 3,
} as const;

export type PermissionTier = (typeof PermissionTier)[keyof typeof PermissionTier];

export const permissionTierSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique stable identifier, e.g. "fs.readFile" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for input validation */
  input: z.ZodType<TInput>;
  /** Permission tier */
  permission: PermissionTier;
  /** Execute the tool; must validate input via zod first */
  execute: (input: TInput) => Promise<TOutput>;
  /** Verify that execute() succeeded — never report success without this */
  verify: (input: TInput, output: TOutput) => Promise<boolean>;
}

// Example helper: validate input before execution
export function validateToolInput<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data) as T;
}
