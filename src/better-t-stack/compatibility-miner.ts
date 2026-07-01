/**
 * Dynamically mines compatibility rules from the installed Better-T-Stack
 * package.
 *
 * The `schema` command exposes valid *values* per option but not the
 * cross-field *rules* (e.g. "Drizzle does not support MongoDB"). Those rules
 * live as error strings in the engine's compiled source. Rather than hardcode
 * them — which would rot on the next release — we locate the installed package
 * and extract the rule messages with a set of resilient patterns.
 *
 * This is strictly best-effort enrichment: it makes the AI's first attempt more
 * likely to be valid, but correctness is still guaranteed by the dry-run
 * validation oracle. If nothing can be mined, an empty list is returned.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Logger } from "../utils/logger.ts";

/** Sentence fragments that reliably mark a compatibility constraint. */
const RULE_MARKERS = [
  "does not support",
  "not compatible",
  "is not compatible",
  "requires",
  "Cannot combine",
  "only supported",
  "only works with",
  "cannot be used",
  "is only supported",
  "Please use",
];

const QUOTED_RULE = new RegExp(
  `["\`]([^"\`]*(?:${RULE_MARKERS.join("|")})[^"\`]*)["\`]`,
  "g",
);

export class CompatibilityMiner {
  constructor(private readonly logger: Logger) {}

  /** Returns a de-duplicated, cleaned list of compatibility rule sentences. */
  async mine(): Promise<readonly string[]> {
    const pkgDir = await this.locatePackage();
    if (!pkgDir) {
      this.logger.debug("compatibility-miner: installed package not found; skipping enrichment");
      return [];
    }

    const distDir = join(pkgDir, "dist");
    if (!existsSync(distDir)) return [];

    const rules = new Set<string>();
    let files: string[];
    try {
      files = (await readdir(distDir)).filter((f) => f.endsWith(".mjs") || f.endsWith(".js"));
    } catch {
      return [];
    }

    for (const file of files) {
      let source: string;
      try {
        source = await readFile(join(distDir, file), "utf8");
      } catch {
        continue;
      }
      for (const match of source.matchAll(QUOTED_RULE)) {
        const rule = this.clean(match[1] ?? "");
        if (rule) rules.add(rule);
      }
    }

    this.logger.debug(`compatibility-miner: extracted ${rules.size} rule(s) from ${pkgDir}`);
    return [...rules].sort();
  }

  /** Fragments that indicate we captured source code rather than a message. */
  private static readonly CODE_TOKENS = [
    "=>",
    "){",
    ");",
    "isSilent",
    "return ",
    "pc.yellow",
    "console.",
    "function",
    "&&",
    "||",
    "${",
    ".join(",
    "bts_", // MCP tool identifiers, not user-facing rules
    "MCP",
    "This tool",
  ];

  /** Normalizes a raw match: unescape, drop template placeholders and noise. */
  private clean(raw: string): string | null {
    const text = raw
      .replace(/\\n/g, " ")
      .replace(/\$\{[^}]*\}/g, "…") // template interpolations
      .replace(/\s+/g, " ")
      .trim();

    // A real rule reads like a sentence: starts with a letter or a quoted flag.
    if (!/^['"a-z]/i.test(text)) return null;
    if (text.length < 24) return null;
    // Reject fragments that still contain code-like tokens.
    if (CompatibilityMiner.CODE_TOKENS.some((token) => text.includes(token))) return null;
    // Trim noisy multi-part messages (URLs, notes) down to their first sentence.
    if (text.includes("http") || text.includes("…")) {
      const head = text.split(/\.\s/)[0]?.trim();
      return head && head.length >= 24 ? `${head}.` : null;
    }
    return text;
  }

  /** Searches known locations for the installed create-better-t-stack package. */
  private async locatePackage(): Promise<string | null> {
    const explicit = process.env.HERMES_BTS_PKG_DIR?.trim();
    if (explicit && existsSync(explicit)) return explicit;

    const candidates: string[] = [
      join(process.cwd(), "node_modules", "create-better-t-stack"),
    ];

    // npx caches packages under ~/.npm/_npx/<hash>/node_modules/<pkg>.
    const npxRoot = join(homedir(), ".npm", "_npx");
    if (existsSync(npxRoot)) {
      try {
        for (const hash of await readdir(npxRoot)) {
          candidates.push(join(npxRoot, hash, "node_modules", "create-better-t-stack"));
        }
      } catch {
        // ignore unreadable cache
      }
    }

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }
}
