/**
 * Composition root.
 *
 * Constructs and wires the application's services (dependency injection lives
 * here and nowhere else). Commands receive a fully-built {@link AppContext} and
 * never instantiate infrastructure directly, which keeps them testable and free
 * of engine/provider knowledge.
 */
import { StackArchitect } from "../ai/architect.ts";
import { createProvider } from "../ai/factory.ts";
import type { AiProvider, ProviderConfig, ProviderName } from "../ai/provider.ts";
import type { BetterTStackAdapter } from "../better-t-stack/adapter.ts";
import { BetterTStackCliAdapter } from "../better-t-stack/cli-adapter.ts";
import { ExecaEngineRunner } from "../better-t-stack/runner.ts";
import { StackPlanner } from "../services/planner.ts";
import { ConsoleLogger, type Logger } from "../utils/logger.ts";

/** Options shared by every command, parsed from global flags. */
export interface GlobalOptions {
  readonly verbose: boolean;
  readonly provider: ProviderName;
  readonly model?: string;
  readonly yes: boolean;
  readonly dryRun: boolean;
  readonly output?: string;
}

/** A cohesive set of AI services sharing one provider, catalog, and rules. */
export interface StackTeam {
  readonly provider: AiProvider;
  readonly architect: StackArchitect;
  readonly planner: StackPlanner;
}

export class AppContext {
  private constructor(
    readonly logger: Logger,
    readonly adapter: BetterTStackAdapter,
  ) {}

  /** Builds a context from global options. */
  static create(options: { verbose: boolean }): AppContext {
    const logger = new ConsoleLogger(options.verbose);
    const runner = new ExecaEngineRunner(logger);
    const adapter = new BetterTStackCliAdapter(runner, logger);
    return new AppContext(logger, adapter);
  }

  /**
   * Builds the AI planning team for a provider. Discovery (catalog + rules) runs
   * here so every command that plans shares the same discovered source of truth.
   */
  async buildStackTeam(providerName: ProviderName, config: ProviderConfig): Promise<StackTeam> {
    const [catalog, rules] = await Promise.all([
      this.adapter.discoverCatalog(),
      this.adapter.discoverCompatibilityRules(),
    ]);
    const provider = createProvider(providerName, config);
    const architect = new StackArchitect(provider, catalog, rules, this.logger);
    const planner = new StackPlanner(architect, this.adapter, this.logger);
    return { provider, architect, planner };
  }
}
