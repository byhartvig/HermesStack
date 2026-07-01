#!/usr/bin/env bun
/**
 * Executable entry point for the `hermes-stack` CLI.
 *
 * Kept intentionally thin: it delegates immediately to the composition root in
 * {@link file://../src/cli/index.ts}. Bun executes TypeScript directly, so no
 * build step is required for `bun link`.
 */
import { run } from "../src/cli/index.ts";

await run(process.argv);
