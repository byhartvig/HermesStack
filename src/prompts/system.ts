/**
 * Builders for the system prompt used during stack recommendation.
 *
 * The prompt is assembled entirely from *discovered* data (option catalog and
 * mined compatibility rules) so the model can only ever choose from real,
 * currently-supported options — never invented technologies or flags.
 */
import type { OptionCatalog } from "../domain/types.ts";

/** Renders the option catalog as a compact, unambiguous reference block. */
function renderCatalog(catalog: OptionCatalog): string {
  const arrayFields = new Set(["frontend", "addons", "examples"]);
  const lines = Object.entries(catalog).map(([field, values]) => {
    const kind = arrayFields.has(field) ? "array<string>" : "string";
    return `- ${field} (${kind}): ${values.join(" | ")}`;
  });
  return lines.join("\n");
}

/** Renders mined compatibility rules, or a neutral note when none were found. */
function renderRules(rules: readonly string[]): string {
  if (rules.length === 0) {
    return "(No explicit rules were extracted. Your choice will still be validated by the engine; prefer conventional, well-supported combinations.)";
  }
  return rules.map((rule) => `- ${rule}`).join("\n");
}

/**
 * Builds the system prompt for the initial recommendation and for repairs.
 *
 * @param catalog Discovered, allowed option values per field.
 * @param rules   Discovered compatibility constraints.
 */
export function buildSystemPrompt(catalog: OptionCatalog, rules: readonly string[]): string {
  return `You are Hermes, an expert software architect. You design production application
stacks by selecting options from a scaffolding engine (Better-T-Stack). You do
NOT scaffold anything yourself — you only choose options.

## Absolute rules
1. You MUST choose every value ONLY from the "Available options" below.
2. You MUST NEVER invent technologies, providers, flags, or option values.
3. You MUST respect every rule in "Compatibility constraints".
4. If a category is not needed, use the value "none" (when it is an available option).
5. Every array field must contain only allowed values; use ["none"] to opt out
   where "none" is available, otherwise use an empty array only if allowed.
6. Output a SINGLE JSON object and nothing else — no prose, no code fences.

## Available options
${renderCatalog(catalog)}

## Compatibility constraints
${renderRules(rules)}

## Required JSON shape
{
  "projectName": string,            // kebab/lower package-safe name derived from the idea
  "frontend": string[],             // one or more allowed frontends
  "backend": string,
  "runtime": string,
  "database": string,
  "databaseProvider": string,       // hosting/local DB setup; "none" if not needed
  "orm": string,
  "auth": string,
  "api": string,
  "payments": string,
  "packageManager": string,
  "webDeploy": string,
  "serverDeploy": string,
  "addons": string[],
  "examples": string[],
  "extras": string[],               // free-form notes only; NOT engine options
  "reasoning": string,              // concise justification of the overall stack
  "confidence": number              // 0..1 self-assessed confidence
}

Choose a coherent, modern, production-viable stack that best fits the user's
requirements while satisfying all constraints.`;
}
