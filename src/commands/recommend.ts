/**
 * `hermes-stack recommend` — plan and print a validated stack without
 * scaffolding. Optionally writes the decision JSON to `--output` for later use
 * with `hermes-stack validate` or `create-json`.
 */
import type { AppContext, GlobalOptions } from "../cli/context.ts";
import { writeTextFile } from "../utils/fs.ts";
import { renderCommand, renderDecision, renderReasoning } from "../utils/present.ts";
import { providerConfigFrom, resolveRequirements } from "./shared.ts";

export interface RecommendCommandInput {
  readonly requirements: string | undefined;
  readonly file: string | undefined;
}

export async function runRecommend(
  ctx: AppContext,
  input: RecommendCommandInput,
  options: GlobalOptions,
): Promise<void> {
  const requirements = await resolveRequirements(input.requirements, input.file);
  const { logger } = ctx;

  const discovery = logger.spinner("Discovering options and consulting the AI…");
  const team = await ctx.buildStackTeam(options.provider, providerConfigFrom(options));
  const planned = await team.planner.plan(requirements);
  discovery.succeed(
    planned.repairs === 0
      ? "Recommendation ready."
      : `Recommendation ready (after ${planned.repairs} repair(s)).`,
  );

  logger.blank();
  logger.raw(renderDecision(planned.decision));
  logger.blank();
  logger.raw(renderReasoning(planned.decision));
  logger.blank();
  logger.raw(renderCommand(planned.validation.reproducibleCommand));
  logger.blank();

  if (options.output) {
    const path = await writeTextFile(options.output, JSON.stringify(planned.decision, null, 2));
    logger.success(`Decision written to ${path}`);
  } else {
    logger.info("Re-run with --output stack.json to save this decision.");
  }
}
