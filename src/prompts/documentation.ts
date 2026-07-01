/**
 * Prompt builder for generating `STACK_DECISION.md`.
 *
 * The model is given the validated decision and the engine's fully-resolved
 * config, and asked to produce a thorough architecture document.
 */
import type { StackDecision } from "../domain/types.ts";

/** System prompt establishing the documentation author role. */
export const DOCUMENTATION_SYSTEM_PROMPT = `You are a principal engineer writing an architecture decision record for a newly
scaffolded project. Write clear, honest, and specific Markdown. Do not invent
facts about the stack; base everything on the provided decision. Avoid marketing
language. Use realistic figures and clearly label estimates as estimates.`;

/** Builds the documentation user prompt. */
export function buildDocumentationPrompt(
  requirements: string,
  decision: StackDecision,
  resolvedConfig: Readonly<Record<string, unknown>>,
  reproducibleCommand: string,
): string {
  return `Write a complete \`STACK_DECISION.md\` for this project.

<requirements>
${requirements.trim()}
</requirements>

<decision>
${JSON.stringify(decision, null, 2)}
</decision>

<resolved_engine_config>
${JSON.stringify(resolvedConfig, null, 2)}
</resolved_engine_config>

<reproducible_command>
${reproducibleCommand}
</reproducible_command>

Structure the document with these sections (use \`##\` headings):
1. Overview — what is being built and the high-level stack in one paragraph.
2. Architecture Decisions — for EACH chosen technology: why it was chosen, the
   trade-offs, and the main alternatives that were rejected (and why).
3. Estimated Monthly Cost — a small table of components with estimated ranges
   for early stage vs. growth; label all numbers as estimates.
4. Deployment Recommendation — concrete deployment approach for this exact stack.
5. Scalability — where this stack scales well and where the first bottlenecks
   will appear.
6. Developer Experience — onboarding, local dev, and iteration speed.
7. Reproduce This Stack — include the reproducible command in a code block.

Return only the Markdown document (no code fence around the whole thing).`;
}
