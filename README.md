<div align="center">

# ⚡ HermesStack

**An AI-first architect for [Better-T-Stack](https://better-t-stack.dev).**

Describe your app in plain English. HermesStack discovers every option the
scaffolding engine supports, asks an LLM to design the best possible stack,
validates it against the engine's own rules, generates the command, runs it,
and documents every decision.

```bash
hermes-stack new "A SaaS for podcast transcription with auth, payments, an admin dashboard and background jobs"
```

</div>

---

## Why

Better-T-Stack is a superb scaffolding engine, but choosing *the right options*
for a given product — and avoiding the dozens of incompatible combinations —
still requires expertise. HermesStack is **not a replacement** for Better-T-Stack;
it is an AI architect that drives it:

- 🧠 **Natural language in, production stack out.**
- 🔍 **Zero hardcoded options.** Everything is discovered live from the engine.
- 🛡️ **Never scaffolds an invalid project.** Every decision is validated by the
  engine's own dry-run oracle, and automatically repaired if wrong.
- 🔌 **Pluggable AI providers** — Claude, OpenAI, Gemini, DeepSeek, or any local
  OpenAI-compatible server.
- 📄 **Self-documenting.** Generates a `STACK_DECISION.md` explaining every
  choice, trade-offs, costs, and deployment guidance.

## How it works

```
requirements ─▶ discover options ─▶ AI proposes ─▶ Zod validates shape
                     ▲                                     │
                     │                                     ▼
              (single source of truth)          engine dry-run validates
                                                    compatibility
                                                         │
                                          valid ◀────────┴────────▶ invalid
                                            │                          │
                                            ▼                          ▼
                                   scaffold + document      feed error to AI, repair
```

1. **Discover** — `create-better-t-stack schema` is the single source of truth
   for every option; compatibility rules are mined from the installed package.
2. **Recommend** — the AI receives *only* the discovered options and rules, and
   returns a JSON stack decision. It can never invent a technology or flag.
3. **Validate** — the decision's shape is checked with **Zod** (enums built at
   runtime from the discovered catalog), then its *compatibility* is checked by
   running the engine in `--dry-run`.
4. **Repair** — if the engine rejects a combination, its exact error message is
   fed back to the AI, which produces a corrected decision. Bounded retries.
5. **Scaffold** — the validated decision is executed via the engine's
   agent-friendly `create-json` command.
6. **Document** — a `STACK_DECISION.md` is generated for the new project.

Because options and rules are discovered at runtime, **HermesStack keeps working
when Better-T-Stack ships new options** — no code change required.

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
git clone https://github.com/byhartvig/HermesStack.git
cd HermesStack
bun install
bun link          # makes `hermes-stack` available everywhere on your Mac
```

Set the API key for your chosen provider (Claude is the default):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY / GEMINI_API_KEY / DEEPSEEK_API_KEY
```

Verify your setup:

```bash
hermes-stack doctor
```

## Commands

| Command | Description |
| --- | --- |
| `hermes-stack new [text\|file]` | Design → validate → scaffold → document. |
| `hermes-stack recommend [text\|file]` | Recommend & validate a stack, no scaffolding. |
| `hermes-stack validate <stack.json>` | Validate a saved decision against the live schema + engine. |
| `hermes-stack schema [--json] [--rules]` | Show the options (and rules) discovered from the engine. |
| `hermes-stack doctor` | Diagnose runtimes, engine reachability, and credentials. |

### Examples

```bash
# From an inline description
hermes-stack new "Build a CRM with team accounts, Stripe billing and an admin panel"

# From a requirements document
hermes-stack new --file requirements.md

# Just get a recommendation and save it
hermes-stack recommend "A realtime chat app" --output stack.json

# Validate a decision you saved or hand-edited
hermes-stack validate stack.json

# Inspect what the engine currently supports
hermes-stack schema --rules

# Preview everything without writing files
hermes-stack new "A blog with a CMS" --dry-run
```

## Flags

| Flag | Effect |
| --- | --- |
| `-y, --yes` | Skip confirmation prompts. |
| `--dry-run` | Validate and preview without writing files. |
| `-o, --output <path>` | Project directory (`new`) or decision file (`recommend`). |
| `-v, --verbose` | Show detailed diagnostics (engine commands, retries, errors). |
| `-p, --provider <name>` | `claude` (default), `openai`, `gemini`, `deepseek`, `local`. |
| `-m, --model <model>` | Override the provider's model. |
| `-f, --file <path>` | Read requirements from a file (`new`, `recommend`). |

## AI providers

All providers implement a single `AiProvider` interface, so adding one is a
matter of implementing one method. Built-ins:

| Provider | Env var | Default model |
| --- | --- | --- |
| `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `local` | *(keyless)* | `LOCAL_AI_MODEL` |

For local/self-hosted servers (Ollama, LM Studio, vLLM):

```bash
export LOCAL_AI_BASE_URL=http://localhost:11434/v1
export LOCAL_AI_MODEL=llama3.1
hermes-stack new "A todo app" --provider local
```

## Architecture

The Better-T-Stack integration is fully isolated behind an adapter. The rest of
the app depends only on the `BetterTStackAdapter` interface and a vendor-neutral
domain model — it knows nothing about engine flags, commands, or JSON shapes. If
the engine changes, only the adapter changes.

```
src/
  cli/            # Commander wiring + composition root (dependency injection)
  commands/       # One module per command (new, recommend, validate, schema, doctor)
  ai/             # Provider interface, factory, providers, and the StackArchitect
  better-t-stack/ # The adapter, process runner, schema types, compatibility miner
  services/       # StackPlanner — the recommend → validate → repair use case
  validators/     # Dynamic Zod schemas built from the discovered option catalog
  prompts/        # System / user / documentation prompt builders
  domain/         # Vendor-neutral types (StackDecision, ValidationResult, …)
  utils/          # Logger, errors, JSON extraction, filesystem, presentation
```

**Design principles:** strongly typed (zero `any`), dependency injection at the
composition root, clean separation of concerns, and comprehensive error handling
via a typed `HermesError` hierarchy.

## Development

```bash
bun install
bun run typecheck   # tsc --noEmit (strict)
bun test            # pipeline tests (stubbed provider + real engine oracle)
bun run start -- doctor
```

The test suite exercises the full planning pipeline — including the
error-driven repair loop — without calling a live LLM, by scripting a stub
provider against the real engine dry-run.

## License

[MIT](./LICENSE) © Allan Hartvig
