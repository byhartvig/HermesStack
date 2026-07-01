/**
 * Dynamic Zod validation for AI-produced {@link StackDecision} objects.
 *
 * Crucially, the enum members are built *at runtime* from the discovered
 * {@link OptionCatalog}, not hardcoded. When Better-T-Stack adds a new database
 * or frontend, this validator accepts it automatically with no code change,
 * while still rejecting anything the AI invents.
 */
import { z } from "zod";
import type { ZodType } from "zod";
import type { OptionCatalog, StackDecision } from "../domain/types.ts";
import { ValidationError } from "../utils/errors.ts";

/** Result of validating raw model output. */
export type DecisionValidation =
  | { readonly ok: true; readonly decision: StackDecision }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Builds a scalar enum validator from a catalog entry. Falls back to a plain
 * string validator when the category is unknown (forward-compatible).
 */
function scalar(catalog: OptionCatalog, field: string) {
  const values = catalog[field];
  if (!values || values.length === 0) return z.string();
  return z.enum([...values] as [string, ...string[]]);
}

/** Builds an array-of-enum validator from a catalog entry. */
function list(catalog: OptionCatalog, field: string) {
  const values = catalog[field];
  const element =
    values && values.length > 0 ? z.enum([...values] as [string, ...string[]]) : z.string();
  return z.array(element);
}

/**
 * Constructs the full decision schema for a given catalog. The shape is fixed
 * and strongly typed; only the allowed values vary with the catalog.
 */
export function buildDecisionSchema(catalog: OptionCatalog): ZodType<StackDecision> {
  const schema = z.object({
    projectName: z
      .string()
      .min(1, "projectName is required")
      .max(214, "projectName is too long")
      .regex(
        /^[a-z0-9](?:[a-z0-9-._]*[a-z0-9])?$/i,
        "projectName must be a valid package/directory name",
      ),
    frontend: list(catalog, "frontend").min(1, "at least one frontend is required"),
    backend: scalar(catalog, "backend"),
    runtime: scalar(catalog, "runtime"),
    database: scalar(catalog, "database"),
    databaseProvider: scalar(catalog, "databaseProvider"),
    orm: scalar(catalog, "orm"),
    auth: scalar(catalog, "auth"),
    api: scalar(catalog, "api"),
    payments: scalar(catalog, "payments"),
    packageManager: scalar(catalog, "packageManager"),
    webDeploy: scalar(catalog, "webDeploy"),
    serverDeploy: scalar(catalog, "serverDeploy"),
    addons: list(catalog, "addons"),
    examples: list(catalog, "examples"),
    extras: z.array(z.string()),
    reasoning: z.string().min(1, "reasoning is required"),
    confidence: z.number().min(0).max(1),
  });
  // The object schema's inferred type structurally matches StackDecision.
  return schema as unknown as ZodType<StackDecision>;
}

/** Validates raw parsed model output against a catalog-derived schema. */
export function validateDecision(catalog: OptionCatalog, raw: unknown): DecisionValidation {
  const schema = buildDecisionSchema(catalog);
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, decision: result.data };
  }
  const issues = result.error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  return { ok: false, issues };
}

/**
 * Validates and throws a {@link ValidationError} on failure. Used where a
 * caller cannot meaningfully continue with an invalid decision.
 */
export function parseDecisionOrThrow(catalog: OptionCatalog, raw: unknown): StackDecision {
  const result = validateDecision(catalog, raw);
  if (result.ok) return result.decision;
  throw new ValidationError("The stack decision failed schema validation.", {
    details: result.issues.join("\n"),
  });
}
