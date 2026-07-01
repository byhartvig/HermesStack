---
name: hermes-stack
description: Design and scaffold a new application stack from natural-language requirements using the HermesStack CLI (an AI architect around Better-T-Stack). Use when the user wants to start a new project/app, pick a tech stack, scaffold a codebase, or asks "what stack should I use for X". Triggers on "new app", "scaffold", "bootstrap a project", "recommend a stack", "spin up a SaaS/CRM/etc.".
allowed-tools: Bash, Read
---

# HermesStack

`hermes-stack` is an AI-first architect CLI. It discovers every option
Better-T-Stack supports (live, never hardcoded), asks an LLM to design the best
stack for a description, validates it against the engine's own compatibility
rules, scaffolds the project, and writes a `STACK_DECISION.md`.

## When to use this skill

- The user describes an app they want to build and needs a stack chosen.
- The user wants to scaffold / bootstrap a new project.
- The user asks for a stack recommendation, or to validate a stack choice.

## Preflight

1. Check the CLI is installed: `hermes-stack --version`.
   - If missing, install it: `cd <repo> && bun install && bun link`, or point
     the user to https://github.com/byhartvig/HermesStack.
2. Check environment and credentials: `hermes-stack doctor`.
   - The selected provider needs its API key (default `claude` →
     `ANTHROPIC_API_KEY`). If unset, ask the user which provider/key to use, or
     pass `--provider`.

## How to run

Pick the command that matches intent. Always prefer `--dry-run` first when the
user hasn't explicitly asked to write files, then confirm before scaffolding.

- **Recommend only (no files):**
  ```bash
  hermes-stack recommend "<requirements>" --output stack.json
  ```
- **Full scaffold:**
  ```bash
  hermes-stack new "<requirements>" --yes
  ```
  Add `-o <dir>` to choose the target directory. Drop `--yes` to let the user
  confirm interactively.
- **Preview without writing:**
  ```bash
  hermes-stack new "<requirements>" --dry-run
  ```
- **Validate a saved / hand-edited decision:**
  ```bash
  hermes-stack validate stack.json
  ```
- **Inspect supported options / rules:**
  ```bash
  hermes-stack schema --rules
  ```

### Useful flags

`--provider <claude|openai|gemini|deepseek|local>`, `--model <id>`,
`--file <requirements.md>`, `--output <path>`, `--dry-run`, `--yes`,
`--verbose`.

## Workflow guidance

1. Turn the user's request into a clear one-paragraph requirements string
   (include auth, payments, background jobs, admin, realtime, mobile, etc. if
   mentioned). If they have a spec file, use `--file`.
2. Run `recommend` (or `new --dry-run`) first. Show the recommended stack,
   reasoning, confidence, and the reproducible command to the user.
3. If the user is happy, run `new` to scaffold. HermesStack never scaffolds an
   invalid stack — it auto-repairs incompatible choices against the engine.
4. After scaffolding, read the generated `STACK_DECISION.md` and summarize the
   key decisions, estimated cost, and deployment recommendation for the user.

## Notes

- HermesStack itself validates every AI choice against Better-T-Stack's dry-run
  oracle, so trust its output over guessing flags manually.
- If a command fails, re-run with `--verbose` to see the engine command and any
  compatibility errors, and relay the fix to the user.
