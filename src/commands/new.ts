/**
 * `hermes-stack new` — the full pipeline.
 *
 * requirements → discover → recommend → validate/repair → confirm → scaffold →
 * document. Never scaffolds an invalid stack (the planner guarantees validity).
 */
import { join } from "node:path";
import type { AppContext, GlobalOptions } from "../cli/context.ts";
import { toMessage } from "../utils/errors.ts";
import { writeTextFile } from "../utils/fs.ts";
import { renderCommand, renderDecision, renderReasoning } from "../utils/present.ts";
import { confirm, providerConfigFrom, resolveRequirements } from "./shared.ts";

/** Positional + option inputs specific to `new`. */
export interface NewCommandInput {
  readonly requirements: string | undefined;
  readonly file: string | undefined;
}

export async function runNew(
  ctx: AppContext,
  input: NewCommandInput,
  options: GlobalOptions,
): Promise<void> {
  const requirements = await resolveRequirements(input.requirements, input.file);
  const { logger } = ctx;

  const discovery = logger.spinner("Discovering Better-T-Stack options…");
  const team = await ctx.buildStackTeam(options.provider, providerConfigFrom(options));
  discovery.succeed(`Using engine: ${ctx.adapter.describeEngine()} · provider: ${team.provider.name} (${team.provider.model})`);

  const planning = logger.spinner("Asking the AI to architect your stack…");
  let planned;
  try {
    planned = await team.planner.plan(requirements);
  } catch (error) {
    planning.fail("Could not produce a valid stack.");
    throw error;
  }
  planning.succeed(
    planned.repairs === 0
      ? "Stack validated on the first attempt."
      : `Stack validated after ${planned.repairs} repair${planned.repairs === 1 ? "" : "s"}.`,
  );

  logger.blank();
  logger.raw(renderDecision(planned.decision));
  logger.blank();
  logger.raw(renderReasoning(planned.decision));
  logger.blank();
  logger.raw(renderCommand(planned.validation.reproducibleCommand));
  logger.blank();

  const targetDirectory = options.output ?? process.cwd();

  if (options.dryRun) {
    logger.info("Dry run: no files were written.");
    await maybeWriteDecisionDoc(ctx, team, requirements, planned, targetDirectory, true);
    return;
  }

  const proceed = await confirm("Scaffold this project now?", options);
  if (!proceed) {
    logger.warn("Aborted. No files were written.");
    return;
  }

  const scaffolding = logger.spinner("Scaffolding project with Better-T-Stack…");
  scaffolding.stop(); // engine streams its own output
  const result = await ctx.adapter.scaffold(planned.decision, {
    dryRun: false,
    install: true,
    git: true,
    targetDirectory,
  });
  if (result.success) {
    logger.success(
      result.projectDirectory
        ? `Project scaffolded at ${result.projectDirectory}`
        : "Project scaffolded.",
    );
  }

  await maybeWriteDecisionDoc(ctx, team, requirements, planned, targetDirectory, false);
}

/**
 * Generates STACK_DECISION.md. Documentation failures are non-fatal: a scaffolded
 * project is more valuable than aborting over missing docs.
 */
async function maybeWriteDecisionDoc(
  ctx: AppContext,
  team: Awaited<ReturnType<AppContext["buildStackTeam"]>>,
  requirements: string,
  planned: Awaited<ReturnType<import("../services/planner.ts").StackPlanner["plan"]>>,
  targetDirectory: string,
  dryRun: boolean,
): Promise<void> {
  const { logger } = ctx;
  const spinner = logger.spinner("Writing STACK_DECISION.md…");
  try {
    const markdown = await team.architect.document(
      requirements,
      planned.decision,
      planned.validation.resolvedConfig,
      planned.validation.reproducibleCommand,
    );
    // In dry-run, write alongside cwd; otherwise into the (likely new) project dir
    // if it exists, falling back to the target directory.
    const projectSubdir = planned.decision.projectName;
    const destDir = dryRun ? targetDirectory : join(targetDirectory, projectSubdir);
    const path = await writeDecisionSafely(destDir, targetDirectory, markdown);
    spinner.succeed(`Documentation written to ${path}`);
  } catch (error) {
    spinner.fail("Skipped documentation generation.");
    logger.debug(`documentation error: ${toMessage(error)}`);
  }
}

/** Tries the project directory first, then the target directory. */
async function writeDecisionSafely(
  preferredDir: string,
  fallbackDir: string,
  markdown: string,
): Promise<string> {
  const { existsSync } = await import("node:fs");
  const dir = existsSync(preferredDir) ? preferredDir : fallbackDir;
  return writeTextFile(join(dir, "STACK_DECISION.md"), markdown);
}
