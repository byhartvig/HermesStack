/**
 * Builders for user-role prompts: the initial requirements prompt and the
 * repair prompt that feeds engine validation errors back to the model.
 */
import type { StackDecision } from "../domain/types.ts";

/** Wraps the raw requirements the user supplied. */
export function buildRequirementsPrompt(requirements: string): string {
  return `Design the best stack for the following application requirements.

<requirements>
${requirements.trim()}
</requirements>

Return only the JSON object described in your instructions.`;
}

/**
 * Builds a repair prompt. The model is shown its previous (invalid) decision and
 * the exact reasons it was rejected, and asked to produce a corrected object.
 */
export function buildRepairPrompt(
  requirements: string,
  previous: StackDecision,
  errors: readonly string[],
): string {
  return `Your previous stack decision was rejected. Fix it.

<requirements>
${requirements.trim()}
</requirements>

<previous_decision>
${JSON.stringify(previous, null, 2)}
</previous_decision>

<validation_errors>
${errors.map((e) => `- ${e}`).join("\n")}
</validation_errors>

Produce a corrected JSON object that resolves EVERY error above while staying as
close as possible to the original intent. Change only what is necessary. Return
only the JSON object.`;
}
