/**
 * End-to-end tests for the planning pipeline using a stubbed AI provider and
 * the real Better-T-Stack adapter (dry-run oracle). These prove that:
 *   - a valid AI proposal passes on the first try, and
 *   - an invalid proposal is repaired using the engine's own error feedback,
 * without ever calling a live LLM.
 */
import { describe, expect, it } from "bun:test";
import { StackArchitect } from "../src/ai/architect.ts";
import type { AiCompletionRequest, AiProvider } from "../src/ai/provider.ts";
import { BetterTStackCliAdapter } from "../src/better-t-stack/cli-adapter.ts";
import { ExecaEngineRunner } from "../src/better-t-stack/runner.ts";
import { StackPlanner } from "../src/services/planner.ts";
import { ConsoleLogger } from "../src/utils/logger.ts";
import { extractJson } from "../src/utils/json.ts";
import { validateDecision } from "../src/validators/stack-decision.ts";

/** A provider that replays scripted responses in order. */
class ScriptedProvider implements AiProvider {
  readonly name = "scripted";
  readonly model = "test";
  private index = 0;
  constructor(private readonly responses: readonly string[]) {}
  async complete(_request: AiCompletionRequest): Promise<string> {
    const response = this.responses[this.index] ?? this.responses.at(-1) ?? "{}";
    this.index++;
    return response;
  }
}

const VALID = JSON.stringify({
  projectName: "echonote",
  frontend: ["next"],
  backend: "hono",
  runtime: "bun",
  database: "postgres",
  databaseProvider: "neon",
  orm: "drizzle",
  auth: "better-auth",
  api: "orpc",
  payments: "polar",
  packageManager: "bun",
  webDeploy: "none",
  serverDeploy: "none",
  addons: ["turborepo"],
  examples: [],
  extras: [],
  reasoning: "Valid test stack.",
  confidence: 0.9,
});

// Wrapped in prose + a code fence to also exercise JSON extraction.
const INVALID_THEN = "Here is the stack:\n```json\n" +
  JSON.stringify({
    projectName: "echonote",
    frontend: ["next"],
    backend: "hono",
    runtime: "bun",
    database: "mongodb",
    databaseProvider: "none",
    orm: "drizzle", // incompatible: drizzle + mongodb
    auth: "better-auth",
    api: "orpc",
    payments: "none",
    packageManager: "bun",
    webDeploy: "none",
    serverDeploy: "none",
    addons: [],
    examples: [],
    extras: [],
    reasoning: "Invalid on purpose.",
    confidence: 0.6,
  }) +
  "\n```";

function build(responses: readonly string[]) {
  const logger = new ConsoleLogger(false);
  const adapter = new BetterTStackCliAdapter(new ExecaEngineRunner(logger), logger);
  return { adapter, logger, provider: new ScriptedProvider(responses) };
}

describe("json extraction", () => {
  it("recovers JSON from fenced, prose-wrapped output", () => {
    const parsed = extractJson("prose\n```json\n{\"a\":1}\n```\nmore") as { a: number };
    expect(parsed.a).toBe(1);
  });
});

describe("schema validation", () => {
  it("rejects invented option values", async () => {
    const { adapter } = build([VALID]);
    const catalog = await adapter.discoverCatalog();
    const result = validateDecision(catalog, {
      ...JSON.parse(VALID),
      database: "cassandra", // not a real option
    });
    expect(result.ok).toBe(false);
  });
});

describe("planner", () => {
  it("accepts a valid proposal on the first attempt", async () => {
    const { adapter, logger, provider } = build([VALID]);
    const [catalog, rules] = await Promise.all([
      adapter.discoverCatalog(),
      adapter.discoverCompatibilityRules(),
    ]);
    const architect = new StackArchitect(provider, catalog, rules, logger);
    const planner = new StackPlanner(architect, adapter, logger);

    const planned = await planner.plan("A podcast transcription SaaS.");
    expect(planned.repairs).toBe(0);
    expect(planned.validation.ok).toBe(true);
    expect(planned.validation.reproducibleCommand).toContain("better-t-stack");
  }, 120_000);

  it("repairs an incompatible proposal using engine feedback", async () => {
    // First response is incompatible (drizzle+mongodb); second is valid.
    const { adapter, logger, provider } = build([INVALID_THEN, VALID]);
    const [catalog, rules] = await Promise.all([
      adapter.discoverCatalog(),
      adapter.discoverCompatibilityRules(),
    ]);
    const architect = new StackArchitect(provider, catalog, rules, logger);
    const planner = new StackPlanner(architect, adapter, logger);

    const planned = await planner.plan("An app with a document database.");
    expect(planned.repairs).toBe(1);
    expect(planned.decision.database).toBe("postgres");
  }, 120_000);
});
