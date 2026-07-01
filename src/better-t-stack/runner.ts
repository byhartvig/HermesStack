/**
 * Process runner for the Better-T-Stack CLI.
 *
 * Isolates *how* the engine binary is located and executed. The invocation is
 * configurable via the `HERMES_BTS_COMMAND` environment variable (a space
 * separated command, e.g. `bunx create-better-t-stack@latest`), defaulting to
 * npx so the tool works with zero setup.
 */
import { execa, type ResultPromise } from "execa";
import type { Logger } from "../utils/logger.ts";

/** Result of a completed engine invocation. */
export interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the process exited 0. */
  readonly ok: boolean;
}

/** Abstraction over spawning the Better-T-Stack CLI. */
export interface EngineRunner {
  /** Runs the engine with `args`, capturing output. Never rejects on non-zero exit. */
  capture(args: readonly string[]): Promise<RunResult>;
  /** Runs the engine, streaming output live to the terminal (for scaffolding). */
  stream(args: readonly string[]): Promise<RunResult>;
  /** The resolved base command, for diagnostics. */
  describe(): string;
}

const DEFAULT_COMMAND = "npx --yes create-better-t-stack@latest";

/** Splits the configured command string into `[bin, ...baseArgs]`. */
function resolveInvocation(): { bin: string; baseArgs: string[] } {
  const raw = process.env.HERMES_BTS_COMMAND?.trim() || DEFAULT_COMMAND;
  const parts = raw.split(/\s+/).filter(Boolean);
  const [bin, ...baseArgs] = parts;
  if (!bin) {
    // Unreachable given DEFAULT_COMMAND, but keeps the type non-optional.
    return { bin: "npx", baseArgs: ["--yes", "create-better-t-stack@latest"] };
  }
  return { bin, baseArgs };
}

/** {@link EngineRunner} backed by `execa`. */
export class ExecaEngineRunner implements EngineRunner {
  private readonly bin: string;
  private readonly baseArgs: string[];

  constructor(private readonly logger: Logger) {
    const { bin, baseArgs } = resolveInvocation();
    this.bin = bin;
    this.baseArgs = baseArgs;
  }

  describe(): string {
    return [this.bin, ...this.baseArgs].join(" ");
  }

  async capture(args: readonly string[]): Promise<RunResult> {
    const full = [...this.baseArgs, ...args];
    this.logger.debug(`exec: ${this.bin} ${full.join(" ")}`);
    const proc: ResultPromise = execa(this.bin, full, {
      reject: false,
      all: false,
      env: { ...process.env, CI: "1" },
    });
    const result = await proc;
    return this.normalize(result);
  }

  async stream(args: readonly string[]): Promise<RunResult> {
    const full = [...this.baseArgs, ...args];
    this.logger.debug(`exec (stream): ${this.bin} ${full.join(" ")}`);
    const proc: ResultPromise = execa(this.bin, full, {
      reject: false,
      stdout: ["pipe", "inherit"],
      stderr: ["pipe", "inherit"],
    });
    const result = await proc;
    return this.normalize(result);
  }

  /** Coerces execa's loosely-typed result into a strict {@link RunResult}. */
  private normalize(result: {
    exitCode?: number | undefined;
    stdout?: unknown;
    stderr?: unknown;
  }): RunResult {
    const exitCode = typeof result.exitCode === "number" ? result.exitCode : 1;
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    return { exitCode, stdout, stderr, ok: exitCode === 0 };
  }
}
