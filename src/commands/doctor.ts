/**
 * `hermes-stack doctor` — environment diagnostics.
 *
 * Verifies that everything the CLI depends on is present and reachable:
 * runtimes, the scaffolding engine, and provider credentials. Purely
 * read-only; never mutates anything.
 */
import chalk from "chalk";
import { execa } from "execa";
import type { AppContext, GlobalOptions } from "../cli/context.ts";
import { PROVIDER_NAMES } from "../ai/factory.ts";
import { toMessage } from "../utils/errors.ts";

/** Status of a single check. */
type CheckLevel = "ok" | "warn" | "fail";

interface Check {
  readonly level: CheckLevel;
  readonly label: string;
  readonly detail: string;
}

/** Env var that holds each provider's credential (local is keyless). */
const PROVIDER_ENV: Readonly<Record<string, string | null>> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  local: null,
};

export async function runDoctor(
  ctx: AppContext,
  options: GlobalOptions,
): Promise<void> {
  const { logger, adapter } = ctx;
  const checks: Check[] = [];

  checks.push(await binaryCheck("bun", ["--version"]));
  checks.push(await binaryCheck("node", ["--version"]));

  // Engine reachability: a light schema fetch proves discovery works end to end.
  const engineSpinner = logger.spinner("Checking Better-T-Stack engine…");
  try {
    const schema = await adapter.discoverRawSchema();
    engineSpinner.stop();
    checks.push({
      level: "ok",
      label: "Better-T-Stack engine",
      detail: `${schema.cli.name}@${schema.cli.version} via ${adapter.describeEngine()}`,
    });
    const rules = await adapter.discoverCompatibilityRules();
    checks.push({
      level: rules.length > 0 ? "ok" : "warn",
      label: "Compatibility rules",
      detail:
        rules.length > 0
          ? `${rules.length} rule(s) mined for AI guidance`
          : "none mined (validation still enforced via dry-run)",
    });
  } catch (error) {
    engineSpinner.stop();
    checks.push({
      level: "fail",
      label: "Better-T-Stack engine",
      detail: toMessage(error),
    });
  }

  // Provider credentials.
  for (const name of PROVIDER_NAMES) {
    const envVar = PROVIDER_ENV[name];
    const selected = name === options.provider;
    if (envVar == null) {
      checks.push({
        level: "ok",
        label: `provider: ${name}${selected ? " (selected)" : ""}`,
        detail: "keyless; configure via LOCAL_AI_BASE_URL / LOCAL_AI_MODEL",
      });
      continue;
    }
    const present = Boolean(process.env[envVar]?.trim());
    checks.push({
      level: present ? "ok" : selected ? "fail" : "warn",
      label: `provider: ${name}${selected ? " (selected)" : ""}`,
      detail: present ? `${envVar} is set` : `${envVar} not set`,
    });
  }

  render(ctx, checks);

  const failed = checks.some((c) => c.level === "fail");
  if (failed) {
    logger.blank();
    logger.error("Some checks failed. Resolve the items above before running `new`.");
    process.exitCode = 1;
  } else {
    logger.blank();
    logger.success("All essential checks passed.");
  }
}

/** Runs `bin --version`-style probes. */
async function binaryCheck(bin: string, args: readonly string[]): Promise<Check> {
  try {
    const { stdout } = await execa(bin, [...args], { reject: true });
    return { level: "ok", label: bin, detail: stdout.trim().split("\n")[0] ?? "present" };
  } catch {
    const optional = bin === "node"; // Bun is the primary runtime.
    return {
      level: optional ? "warn" : "fail",
      label: bin,
      detail: "not found on PATH",
    };
  }
}

/** Prints the checks as an aligned, colorized list. */
function render(ctx: AppContext, checks: readonly Check[]): void {
  const icon: Record<CheckLevel, string> = {
    ok: chalk.green("✔"),
    warn: chalk.yellow("⚠"),
    fail: chalk.red("✖"),
  };
  const width = Math.max(...checks.map((c) => c.label.length));
  ctx.logger.blank();
  for (const check of checks) {
    ctx.logger.raw(`  ${icon[check.level]} ${check.label.padEnd(width)}  ${chalk.dim(check.detail)}`);
  }
}
