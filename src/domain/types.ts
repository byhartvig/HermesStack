/**
 * Provider-agnostic domain model.
 *
 * These types describe *what* an application's architecture looks like in
 * abstract terms. They deliberately contain no knowledge of how Better-T-Stack
 * (or any other scaffolding engine) encodes those choices — that mapping lives
 * exclusively inside the Better-T-Stack adapter.
 */

/**
 * A catalog of the option values that are currently supported, keyed by option
 * category (e.g. `database`, `frontend`). Discovered at runtime — never
 * hardcoded — so the tool keeps working when new options are released.
 */
export type OptionCatalog = Readonly<Record<string, readonly string[]>>;

/**
 * The architectural decision produced by the AI and consumed by the scaffolding
 * adapter. Every string field is expected to be a member of the corresponding
 * {@link OptionCatalog} entry; array fields are subsets of theirs.
 */
export interface StackDecision {
  /** Project directory / package name. */
  readonly projectName: string;
  /** One or more frontend targets (web and/or native). */
  readonly frontend: readonly string[];
  /** Backend framework or `none`/`self`/`convex`. */
  readonly backend: string;
  /** JavaScript runtime for the backend. */
  readonly runtime: string;
  /** Database engine. */
  readonly database: string;
  /**
   * Managed database provider / local setup (e.g. `neon`, `turso`, `docker`).
   * Maps to Better-T-Stack's `db-setup`, but the domain stays vendor-neutral.
   */
  readonly databaseProvider: string;
  /** ORM / data-access layer. */
  readonly orm: string;
  /** Authentication provider. */
  readonly auth: string;
  /** API transport layer. */
  readonly api: string;
  /** Payments provider. */
  readonly payments: string;
  /** Package manager to scaffold with. */
  readonly packageManager: string;
  /** Web deployment target. */
  readonly webDeploy: string;
  /** Server deployment target. */
  readonly serverDeploy: string;
  /** Additional addons (tooling, docs, desktop, etc.). */
  readonly addons: readonly string[];
  /** Example apps to include. */
  readonly examples: readonly string[];
  /** Free-form notes that are not scaffolding options (documentation only). */
  readonly extras: readonly string[];
  /** Natural-language justification for the overall stack. */
  readonly reasoning: string;
  /** Model self-reported confidence in `[0, 1]`. */
  readonly confidence: number;
}

/** Outcome of validating a {@link StackDecision} against the scaffolding engine. */
export type ValidationResult =
  | {
      readonly ok: true;
      /** The fully-resolved configuration the engine would scaffold. */
      readonly resolvedConfig: Readonly<Record<string, unknown>>;
      /** A copy-pasteable command that reproduces this exact stack. */
      readonly reproducibleCommand: string;
    }
  | {
      readonly ok: false;
      /** Human-readable reasons the combination was rejected. */
      readonly errors: readonly string[];
      /** Raw engine output, retained for verbose diagnostics. */
      readonly raw: string;
    };

/** Options controlling a scaffold run. */
export interface ScaffoldOptions {
  /** When true, validate and report without writing files. */
  readonly dryRun: boolean;
  /** When true, run the engine's dependency install step. */
  readonly install: boolean;
  /** When true, initialize a git repository. */
  readonly git: boolean;
  /** Directory to scaffold into (defaults to cwd). */
  readonly targetDirectory: string;
}

/** Outcome of a scaffold run. */
export interface ScaffoldResult {
  /** Whether the engine reported success. */
  readonly success: boolean;
  /** The command that was executed. */
  readonly command: string;
  /** Absolute path of the generated project, when known. */
  readonly projectDirectory?: string;
  /** Combined engine output. */
  readonly output: string;
}
