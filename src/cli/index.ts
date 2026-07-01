/**
 * CLI entry point and command wiring (Commander).
 *
 * Defines global flags, registers subcommands, and provides a single top-level
 * error boundary that renders {@link HermesError}s cleanly and sets a non-zero
 * exit code. Business logic lives in the command modules; this file only wires.
 */
import { Command, Option } from "commander";
import chalk from "chalk";
import { isProviderName } from "../ai/factory.ts";
import type { ProviderName } from "../ai/provider.ts";
import { runDoctor } from "../commands/doctor.ts";
import { runNew } from "../commands/new.ts";
import { runRecommend } from "../commands/recommend.ts";
import { runSchema } from "../commands/schema.ts";
import { runValidate } from "../commands/validate.ts";
import { HermesError, InputError } from "../utils/errors.ts";
import { AppContext, type GlobalOptions } from "./context.ts";

/** Shape of the merged option bag Commander hands to actions. */
interface RawOptions {
  verbose?: boolean;
  provider?: string;
  model?: string;
  yes?: boolean;
  dryRun?: boolean;
  output?: string;
  file?: string;
  json?: boolean;
  rules?: boolean;
}

/** Normalizes and validates the global option bag. */
function toGlobalOptions(raw: RawOptions): GlobalOptions {
  const providerRaw = (raw.provider ?? "claude").toLowerCase();
  if (!isProviderName(providerRaw)) {
    throw new InputError(`Unknown provider: ${raw.provider}`, {
      hint: "Choose one of: claude, openai, gemini, deepseek, local.",
    });
  }
  const provider: ProviderName = providerRaw;
  return {
    verbose: raw.verbose ?? false,
    provider,
    ...(raw.model ? { model: raw.model } : {}),
    yes: raw.yes ?? false,
    dryRun: raw.dryRun ?? false,
    ...(raw.output ? { output: raw.output } : {}),
  };
}

/** Adds the flags shared by every command. */
function withGlobalFlags(command: Command): Command {
  return command
    .option("-v, --verbose", "show detailed diagnostic output")
    .addOption(
      new Option("-p, --provider <name>", "AI provider").choices([
        "claude",
        "openai",
        "gemini",
        "deepseek",
        "local",
      ]),
    )
    .option("-m, --model <model>", "override the provider's model")
    .option("-y, --yes", "skip confirmation prompts")
    .option("--dry-run", "validate and preview without writing files")
    .option("-o, --output <path>", "output path (project dir or decision file)");
}

/** Builds the fully-configured Commander program. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name("hermes-stack")
    .description("AI-first architect that uses Better-T-Stack as its scaffolding engine.")
    .version("0.1.0", "-V, --version");

  // `new` — full pipeline.
  withGlobalFlags(
    program
      .command("new")
      .description("Design, validate, and scaffold a project from requirements")
      .argument("[requirements]", "inline requirements text or a path to a .md file")
      .option("-f, --file <path>", "read requirements from a markdown/text file"),
  ).action(async (requirements: string | undefined, _opts: RawOptions, cmd: Command) => {
    const raw = cmd.optsWithGlobals() as RawOptions;
    const global = toGlobalOptions(raw);
    const ctx = AppContext.create({ verbose: global.verbose });
    await runNew(ctx, { requirements, file: raw.file }, global);
  });

  // `recommend` — plan only.
  withGlobalFlags(
    program
      .command("recommend")
      .description("Recommend and validate a stack without scaffolding")
      .argument("[requirements]", "inline requirements text or a path to a .md file")
      .option("-f, --file <path>", "read requirements from a markdown/text file"),
  ).action(async (requirements: string | undefined, _opts: RawOptions, cmd: Command) => {
    const raw = cmd.optsWithGlobals() as RawOptions;
    const global = toGlobalOptions(raw);
    const ctx = AppContext.create({ verbose: global.verbose });
    await runRecommend(ctx, { requirements, file: raw.file }, global);
  });

  // `validate` — check a stored decision.
  withGlobalFlags(
    program
      .command("validate")
      .description("Validate a stack JSON file against the live schema and engine")
      .argument("<file>", "path to a stack decision JSON file"),
  ).action(async (file: string, _opts: RawOptions, cmd: Command) => {
    const raw = cmd.optsWithGlobals() as RawOptions;
    const global = toGlobalOptions(raw);
    const ctx = AppContext.create({ verbose: global.verbose });
    await runValidate(ctx, file, global);
  });

  // `schema` — show discovered options.
  withGlobalFlags(
    program
      .command("schema")
      .description("Show the options discovered from Better-T-Stack")
      .option("--json", "print the raw engine schema JSON")
      .option("--rules", "also list mined compatibility rules"),
  ).action(async (_opts: RawOptions, cmd: Command) => {
    const raw = cmd.optsWithGlobals() as RawOptions;
    const global = toGlobalOptions(raw);
    const ctx = AppContext.create({ verbose: global.verbose });
    await runSchema(ctx, { json: raw.json ?? false, rules: raw.rules ?? false }, global);
  });

  // `doctor` — diagnostics.
  withGlobalFlags(
    program.command("doctor").description("Diagnose the environment, engine, and credentials"),
  ).action(async (_opts: RawOptions, cmd: Command) => {
    const raw = cmd.optsWithGlobals() as RawOptions;
    const global = toGlobalOptions(raw);
    const ctx = AppContext.create({ verbose: global.verbose });
    await runDoctor(ctx, global);
  });

  return program;
}

/** Parses argv, runs the matched command, and handles all errors centrally. */
export async function run(argv: readonly string[]): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync([...argv]);
  } catch (error) {
    handleError(error, program);
  }
}

/** Renders an error and sets the process exit code (without hard-exiting). */
function handleError(error: unknown, _program: Command): void {
  const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");

  if (error instanceof HermesError) {
    console.error(`\n${chalk.bold.red("✖")} ${error.message}`);
    if (error.hint) console.error(`  ${chalk.yellow("hint:")} ${error.hint}`);
    if (verbose && error.details) console.error(chalk.dim(`\n${error.details}`));
  } else if (error instanceof Error) {
    console.error(`\n${chalk.bold.red("✖")} ${error.message}`);
    if (verbose && error.stack) console.error(chalk.dim(`\n${error.stack}`));
  } else {
    console.error(`\n${chalk.bold.red("✖")} An unexpected error occurred.`);
    if (verbose) console.error(chalk.dim(String(error)));
  }
  process.exitCode = 1;
}
