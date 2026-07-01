/**
 * Better-T-Stack adapter implemented on top of the CLI's agent-friendly
 * commands (`schema`, `create-json`).
 *
 * Discovery strategy (no hardcoded options — ever):
 *  - Option values come from `schema --name all`.
 *  - Compatibility rules are mined from the installed package (best-effort).
 *  - Validation delegates to `create-json --input {…, dryRun:true}`, whose exit
 *    code and error messages are the authoritative compatibility oracle.
 *  - Scaffolding uses the same `create-json` payload without `dryRun`.
 *
 * All Better-T-Stack-specific field mapping is contained in this file.
 */
import type {
  OptionCatalog,
  ScaffoldOptions,
  ScaffoldResult,
  StackDecision,
  ValidationResult,
} from "../domain/types.ts";
import { EngineError, toMessage } from "../utils/errors.ts";
import type { Logger } from "../utils/logger.ts";
import type { BetterTStackAdapter } from "./adapter.ts";
import { CompatibilityMiner } from "./compatibility-miner.ts";
import type { EngineRunner } from "./runner.ts";
import type { BtsCreateInput, BtsCreateResult, BtsSchema, JsonSchemaNode } from "./types.ts";

/**
 * Maps vendor-neutral domain fields to the key under which their allowed values
 * live in the engine schema. This table is the *only* coupling between the
 * domain vocabulary and Better-T-Stack's naming.
 */
const DOMAIN_TO_SCHEMA: Readonly<Record<string, string>> = {
  frontend: "frontend",
  backend: "backend",
  runtime: "runtime",
  database: "database",
  databaseProvider: "databaseSetup",
  orm: "orm",
  auth: "auth",
  api: "api",
  payments: "payments",
  packageManager: "packageManager",
  webDeploy: "webDeploy",
  serverDeploy: "serverDeploy",
  addons: "addons",
  examples: "examples",
};

export class BetterTStackCliAdapter implements BetterTStackAdapter {
  private schemaCache: BtsSchema | undefined;
  private rulesCache: readonly string[] | undefined;
  private readonly miner: CompatibilityMiner;

  constructor(
    private readonly runner: EngineRunner,
    private readonly logger: Logger,
  ) {
    this.miner = new CompatibilityMiner(logger);
  }

  describeEngine(): string {
    return this.runner.describe();
  }

  async discoverRawSchema(): Promise<BtsSchema> {
    if (this.schemaCache) return this.schemaCache;

    const result = await this.runner.capture(["schema", "--name", "all"]);
    if (!result.ok || !result.stdout.trim()) {
      throw new EngineError("Failed to discover the Better-T-Stack schema.", {
        details: result.stderr || result.stdout,
        hint: "Check your network connection and that the engine command is runnable (`hermes-stack doctor`).",
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      throw new EngineError("The engine returned malformed schema JSON.", {
        details: toMessage(error),
      });
    }

    if (!isBtsSchema(parsed)) {
      throw new EngineError("The engine schema had an unexpected shape.", {
        details: "Expected top-level `cli` and `schemas` keys.",
      });
    }

    this.schemaCache = parsed;
    this.logger.debug(
      `discovered schema for ${parsed.cli.name}@${parsed.cli.version} ` +
        `(${Object.keys(parsed.schemas).length} sub-schemas)`,
    );
    return parsed;
  }

  async discoverCatalog(): Promise<OptionCatalog> {
    const schema = await this.discoverRawSchema();
    const catalog: Record<string, readonly string[]> = {};

    for (const [domainField, schemaKey] of Object.entries(DOMAIN_TO_SCHEMA)) {
      const node = schema.schemas[schemaKey];
      const values = node ? extractEnum(node) : null;
      if (values && values.length > 0) {
        catalog[domainField] = values;
      }
    }

    if (Object.keys(catalog).length === 0) {
      throw new EngineError("Discovered an empty option catalog.", {
        hint: "The engine schema format may have changed; update the adapter mapping.",
      });
    }
    return catalog;
  }

  async discoverCompatibilityRules(): Promise<readonly string[]> {
    if (this.rulesCache) return this.rulesCache;
    this.rulesCache = await this.miner.mine();
    return this.rulesCache;
  }

  async validate(decision: StackDecision): Promise<ValidationResult> {
    const input = this.toCreateInput(decision, {
      dryRun: true,
      install: false,
      git: false,
    });
    const result = await this.runner.capture(["create-json", "--input", JSON.stringify(input)]);

    if (result.ok) {
      const payload = safeParse<BtsCreateResult>(result.stdout);
      return {
        ok: true,
        resolvedConfig: payload?.projectConfig ?? {},
        reproducibleCommand: payload?.reproducibleCommand ?? "",
      };
    }

    return {
      ok: false,
      errors: extractEngineErrors(result.stderr, result.stdout),
      raw: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    };
  }

  async scaffold(decision: StackDecision, options: ScaffoldOptions): Promise<ScaffoldResult> {
    const input = this.toCreateInput(decision, options);
    const args = ["create-json", "--input", JSON.stringify(input)];

    // Dry runs are captured (their JSON is useful); real runs stream so the user
    // sees progress from the engine live.
    const result = options.dryRun
      ? await this.runner.capture(args)
      : await this.runner.stream(args);

    if (!result.ok) {
      throw new EngineError("Scaffolding failed.", {
        details: extractEngineErrors(result.stderr, result.stdout).join("\n"),
      });
    }

    const payload = safeParse<BtsCreateResult>(result.stdout);
    const base: ScaffoldResult = {
      success: true,
      command: `${this.runner.describe()} create-json`,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
    };
    return payload?.projectDirectory !== undefined
      ? { ...base, projectDirectory: payload.projectDirectory }
      : base;
  }

  /** Translates the vendor-neutral decision into a Better-T-Stack payload. */
  private toCreateInput(decision: StackDecision, options: {
    dryRun: boolean;
    install: boolean;
    git: boolean;
  }): BtsCreateInput {
    return {
      projectName: decision.projectName,
      frontend: [...decision.frontend],
      backend: decision.backend,
      runtime: decision.runtime,
      database: decision.database,
      orm: decision.orm,
      auth: decision.auth,
      api: decision.api,
      payments: decision.payments,
      packageManager: decision.packageManager,
      dbSetup: decision.databaseProvider,
      webDeploy: decision.webDeploy,
      serverDeploy: decision.serverDeploy,
      addons: [...decision.addons],
      examples: [...decision.examples],
      git: options.git,
      install: options.install,
      dryRun: options.dryRun,
    };
  }
}

/** Extracts the enum from a scalar or array schema node. */
function extractEnum(node: JsonSchemaNode): readonly string[] | null {
  if (node.enum && node.enum.length > 0) return node.enum;
  if (node.items?.enum && node.items.enum.length > 0) return node.items.enum;
  return null;
}

/** Type guard for the top-level schema payload. */
function isBtsSchema(value: unknown): value is BtsSchema {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.cli === "object" &&
    record.cli !== null &&
    typeof record.schemas === "object" &&
    record.schemas !== null
  );
}

/** Parses JSON, returning `undefined` instead of throwing. */
function safeParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/**
 * Pulls readable error sentences out of engine output. The engine reports
 * compatibility failures as `CLIError: <message>` lines on stderr.
 */
function extractEngineErrors(stderr: string, stdout: string): string[] {
  const combined = [stderr, stdout].filter(Boolean).join("\n");
  const messages: string[] = [];

  for (const line of combined.split("\n")) {
    const match = /(?:CLIError|Error|ZodError):\s*(.+)$/.exec(line.trim());
    if (match?.[1]) messages.push(match[1].trim());
  }

  if (messages.length === 0 && combined.trim()) {
    // Fall back to the first non-empty, non-stacktrace line.
    const firstLine = combined
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("at "));
    if (firstLine) messages.push(firstLine);
  }

  return messages.length > 0 ? messages : ["Unknown engine validation error."];
}
