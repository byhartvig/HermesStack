/**
 * Port (interface) for the scaffolding engine.
 *
 * The rest of the application depends only on this abstraction — never on
 * Better-T-Stack directly. Swapping or upgrading the engine means implementing
 * this interface once; no command, prompt, or AI code changes.
 */
import type {
  OptionCatalog,
  ScaffoldOptions,
  ScaffoldResult,
  StackDecision,
  ValidationResult,
} from "../domain/types.ts";
import type { BtsSchema } from "./types.ts";

export interface BetterTStackAdapter {
  /** Returns the raw engine schema (for `hermes-stack schema --json`). */
  discoverRawSchema(): Promise<BtsSchema>;

  /**
   * Returns the supported option values keyed by vendor-neutral domain field.
   * This is the single source of truth for what the AI is allowed to choose.
   */
  discoverCatalog(): Promise<OptionCatalog>;

  /**
   * Returns human-readable compatibility rules mined from the engine, used to
   * pre-warn the AI about invalid combinations. Best-effort: may be empty.
   */
  discoverCompatibilityRules(): Promise<readonly string[]>;

  /**
   * Validates a decision against the engine's own compatibility logic without
   * writing files. This is the authoritative correctness oracle.
   */
  validate(decision: StackDecision): Promise<ValidationResult>;

  /** Scaffolds the project (or dry-runs it) via the engine. */
  scaffold(decision: StackDecision, options: ScaffoldOptions): Promise<ScaffoldResult>;

  /** A human-readable description of the underlying engine invocation. */
  describeEngine(): string;
}
