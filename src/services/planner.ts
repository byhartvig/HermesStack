/**
 * Stack planning use-case.
 *
 * Orchestrates the full recommend → validate → repair loop that guarantees a
 * *compatibility-valid* decision before anything is scaffolded:
 *
 *   1. Ask the architect for a schema-valid decision.
 *   2. Validate it against the engine's dry-run oracle.
 *   3. On rejection, feed the engine's own error messages back to the architect
 *      and retry, up to a bounded number of attempts.
 *
 * The tool never scaffolds an invalid project: if the loop is exhausted, it
 * throws instead of proceeding.
 */
import type { StackArchitect } from "../ai/architect.ts";
import type { BetterTStackAdapter } from "../better-t-stack/adapter.ts";
import type { StackDecision, ValidationResult } from "../domain/types.ts";
import { ValidationError } from "../utils/errors.ts";
import type { Logger } from "../utils/logger.ts";

/** A fully-planned, engine-validated stack. */
export interface PlannedStack {
  readonly decision: StackDecision;
  readonly validation: Extract<ValidationResult, { ok: true }>;
  /** How many repair attempts were needed (0 = valid first try). */
  readonly repairs: number;
}

/** Maximum number of compatibility-repair round-trips with the AI. */
const COMPATIBILITY_REPAIR_LIMIT = 3;

export class StackPlanner {
  constructor(
    private readonly architect: StackArchitect,
    private readonly adapter: BetterTStackAdapter,
    private readonly logger: Logger,
  ) {}

  /**
   * Plans a stack from natural-language requirements, returning only once the
   * decision passes the engine's own validation.
   */
  async plan(requirements: string): Promise<PlannedStack> {
    let decision = await this.architect.propose(requirements);

    for (let repairs = 0; repairs <= COMPATIBILITY_REPAIR_LIMIT; repairs++) {
      const validation = await this.adapter.validate(decision);

      if (validation.ok) {
        return { decision, validation, repairs };
      }

      if (repairs === COMPATIBILITY_REPAIR_LIMIT) {
        throw new ValidationError(
          "Could not produce a valid stack after repeated repair attempts.",
          {
            details: validation.errors.join("\n"),
            hint: "Refine the requirements or try a more capable --model.",
          },
        );
      }

      this.logger.debug(
        `compatibility repair ${repairs + 1}: ${validation.errors.join("; ")}`,
      );
      decision = await this.architect.repair(requirements, decision, validation.errors);
    }

    // Unreachable: the loop either returns or throws.
    throw new ValidationError("Planning terminated unexpectedly.");
  }

  /**
   * Validates an already-formed decision (e.g. from a stack.json file) without
   * involving the AI.
   */
  async validateOnly(decision: StackDecision): Promise<ValidationResult> {
    return this.adapter.validate(decision);
  }
}
