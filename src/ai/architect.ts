/**
 * The AI-facing architect.
 *
 * Responsible purely for talking to the {@link AiProvider}: turning requirements
 * into a schema-valid {@link StackDecision}, repairing a rejected decision, and
 * authoring documentation. It guarantees that whatever it returns has passed
 * *schema* validation (shape + allowed values); cross-field *compatibility* is
 * enforced one layer up by the planner via the engine's dry-run oracle.
 */
import type { OptionCatalog, StackDecision } from "../domain/types.ts";
import { ProviderError, ValidationError } from "../utils/errors.ts";
import { extractJson } from "../utils/json.ts";
import type { Logger } from "../utils/logger.ts";
import { validateDecision } from "../validators/stack-decision.ts";
import type { AiProvider } from "./provider.ts";
import { buildSystemPrompt } from "../prompts/system.ts";
import { buildRepairPrompt, buildRequirementsPrompt } from "../prompts/user.ts";
import {
  DOCUMENTATION_SYSTEM_PROMPT,
  buildDocumentationPrompt,
} from "../prompts/documentation.ts";

/** Number of times to re-ask the model when it violates the *schema*. */
const SCHEMA_RETRY_LIMIT = 2;

export class StackArchitect {
  private readonly systemPrompt: string;

  constructor(
    private readonly provider: AiProvider,
    private readonly catalog: OptionCatalog,
    rules: readonly string[],
    private readonly logger: Logger,
  ) {
    this.systemPrompt = buildSystemPrompt(catalog, rules);
  }

  /** Produces an initial, schema-valid decision from requirements. */
  async propose(requirements: string): Promise<StackDecision> {
    return this.request(buildRequirementsPrompt(requirements));
  }

  /** Produces a corrected decision given prior errors (compatibility or schema). */
  async repair(
    requirements: string,
    previous: StackDecision,
    errors: readonly string[],
  ): Promise<StackDecision> {
    return this.request(buildRepairPrompt(requirements, previous, errors));
  }

  /** Generates the STACK_DECISION.md content. Failures here are non-fatal upstream. */
  async document(
    requirements: string,
    decision: StackDecision,
    resolvedConfig: Readonly<Record<string, unknown>>,
    reproducibleCommand: string,
  ): Promise<string> {
    const text = await this.provider.complete({
      system: DOCUMENTATION_SYSTEM_PROMPT,
      user: buildDocumentationPrompt(requirements, decision, resolvedConfig, reproducibleCommand),
      temperature: 0.4,
      maxTokens: 4096,
    });
    return text.trim();
  }

  /**
   * Sends a prompt and returns a schema-valid decision, retrying with feedback
   * when the model breaks the JSON contract or the value catalog.
   */
  private async request(userPrompt: string): Promise<StackDecision> {
    let prompt = userPrompt;
    let lastIssues: readonly string[] = [];

    for (let attempt = 0; attempt <= SCHEMA_RETRY_LIMIT; attempt++) {
      const raw = await this.provider.complete({
        system: this.systemPrompt,
        user: prompt,
        temperature: 0.2,
        json: true,
        maxTokens: 2048,
      });

      let parsed: unknown;
      try {
        parsed = extractJson(raw);
      } catch (error) {
        lastIssues = [error instanceof Error ? error.message : String(error)];
        this.logger.debug(`schema attempt ${attempt + 1}: JSON parse failed`);
        prompt = this.reprompt(userPrompt, lastIssues);
        continue;
      }

      const validation = validateDecision(this.catalog, parsed);
      if (validation.ok) {
        this.logger.debug(`schema-valid decision on attempt ${attempt + 1}`);
        return validation.decision;
      }

      lastIssues = validation.issues;
      this.logger.debug(`schema attempt ${attempt + 1} rejected: ${validation.issues.join("; ")}`);
      prompt = this.reprompt(userPrompt, validation.issues);
    }

    throw new ValidationError("The AI could not produce a schema-valid stack decision.", {
      details: lastIssues.join("\n"),
      hint: "Try a clearer prompt, a different --model, or --verbose to inspect responses.",
    });
  }

  /** Appends schema-violation feedback to the original prompt for a retry. */
  private reprompt(original: string, issues: readonly string[]): string {
    return `${original}

Your previous response was invalid for these reasons:
${issues.map((i) => `- ${i}`).join("\n")}

Return a corrected JSON object that fixes all of these. Only use allowed values.`;
  }
}

/** Guard used by the factory to fail fast on obviously unusable providers. */
export function assertUsableProvider(provider: AiProvider): void {
  if (!provider.model) {
    throw new ProviderError(`Provider ${provider.name} has no model configured.`);
  }
}
