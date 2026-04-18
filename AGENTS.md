# Agent instructions

This file tells automated assistants (for example, coding agents in Cursor) how to work effectively in this repository.

## Repository snapshot

- **Name:** `plur` (see `README.md`).
- **Current state:** The tree is intentionally minimal. When you add code, document build steps, tests, and conventions here so future runs stay consistent.

## General principles

1. **Match the codebase.** Follow existing layout, naming, imports, and formatting. Prefer extending what is already there over introducing parallel patterns.
2. **Keep changes focused.** Implement only what was asked. Avoid drive-by refactors, unrelated formatting-only edits, and speculative features.
3. **Verify when possible.** After substantive changes, run the project’s documented checks (tests, linters, typecheck, build). If no tooling exists yet, say what you validated manually and what remains untested.
4. **Preserve intent.** Do not delete comments or behavior unrelated to the task unless the user explicitly wants cleanup.

## Git workflow

Unless the user specifies otherwise:

- Create a **feature branch** off `main` for non-trivial work.
- Use **clear commit messages** that explain what changed and why.
- **Push** the branch before opening or updating a pull request.

Naming: if your environment requires a branch prefix or suffix (for example `cursor/…`), follow those rules from the task or platform instructions.

## Pull requests

When a PR is expected:

- Summarize scope, key decisions, and how you tested.
- Link issues or tickets if the user provided them.
- Call out breaking changes, migrations, or new environment variables.

## Documentation

- Update this file when you introduce **new commands**, **architecture**, or **agent-specific** rules (for example, “always run X before committing”).
- Prefer updating **existing** project docs over adding redundant markdown files the user did not request.

## Security and secrets

- Never commit API keys, passwords, tokens, or private URLs. Use environment variables or secret managers as the project standardizes.
- Do not disable security checks (HTTPS verification, certificate pinning, etc.) without explicit user approval and a documented reason.

## When something is unclear

If requirements are ambiguous or conflict with repo constraints, **ask the user** before making large or irreversible choices (schema changes, public API breaks, license changes).
