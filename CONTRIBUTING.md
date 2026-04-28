# Contributing to Arrey

Thanks for taking the time to contribute. Arrey is a small project with a focused scope, and we want it to stay easy to reason about. This guide explains how to get set up, how to propose changes, and the conventions we follow.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Workflow](#workflow)
- [Coding conventions](#coding-conventions)
- [Testing](#testing)
- [Adding a new registry tool](#adding-a-new-registry-tool)
- [Adding a new provider](#adding-a-new-provider)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Releasing](#releasing)
- [Reporting bugs](#reporting-bugs)
- [Requesting features](#requesting-features)

---

## Code of conduct

Be respectful and constructive. Critique ideas, not people. Assume good faith. Maintainers reserve the right to remove comments, commits, or contributions that are abusive, off-topic, or otherwise harmful to the community.

## Ways to contribute

- **Bug fixes** — anything that makes existing behavior match documented behavior
- **New registry tools** — see [Adding a new registry tool](#adding-a-new-registry-tool)
- **New providers** — see [Adding a new provider](#adding-a-new-provider)
- **Documentation** — README, tool READMEs, code comments where they clarify *why*
- **Tests** — increasing coverage of the runtime, CLI, and adapters
- **Triage** — reproducing reported issues, narrowing down failure cases

If you are planning anything beyond a small fix, open an issue first to discuss the approach. This avoids wasted work.

---

## Development setup

### Prerequisites

- Node.js **18+**
- npm 9+

### Clone and install

```bash
git clone https://github.com/<your-fork>/arrey.git
cd arrey
npm install
```

### Build the CLI

```bash
npm run build --workspace arrey-cli
```

### Run the local CLI

```bash
node cli/dist/cli.js init
node cli/dist/cli.js add summarize
node cli/dist/cli.js list
```

### Watch mode

```bash
npm run dev --workspace arrey-cli
```

### Link for end-to-end testing in another project

```bash
cd cli && npm link
cd /path/to/test-project && npm link arrey-cli
```

---

## Project layout

```text
cli/src/
  cli.ts                  # CLI entrypoint
  index.ts                # public runtime API
  commands/               # init | add | install | list — one file per command
  core/                   # installer, registry, project-config, layout, logger
  runtime/                # executor, providers, schema, context-factory, types
registry/                 # tool templates copied into user projects
  tools.json              # registry index — list new tools here
  <tool>/                 # one directory per tool: index.ts, prompt.ts, manifest.json, README.md
```

A few rules of thumb:

- Code in `cli/src/runtime/` is **shipped to end users** — keep it small and dependency-free where possible.
- Code in `registry/<tool>/` is **copied verbatim** into user projects. Treat it as user-owned: no clever abstractions, no shared internal helpers.
- The CLI itself can use whatever helper modules make sense.

---

## Workflow

1. **Fork** the repo and create a branch from `main`:

   ```bash
   git checkout -b fix/short-description
   ```

2. **Make your change.** Keep PRs focused — one logical change per PR.
3. **Add or update tests.** New behavior needs a test. Bug fixes need a regression test.
4. **Run the test suite locally:**

   ```bash
   npm run test --workspace arrey-cli
   ```

5. **Update docs.** If you changed CLI output, config shape, or the runtime API, update the README and any relevant tool READMEs.
6. **Open a PR** against `main` (see [Pull requests](#pull-requests)).

---

## Coding conventions

- **TypeScript**, strict mode. No `any` unless there is a written justification in the PR description.
- **No comments that describe what code does.** Code should read clearly. A comment is only useful when it explains *why* — a non-obvious constraint, a workaround for a known bug, or a subtle invariant.
- **No premature abstractions.** Three similar lines is better than a clever helper that only has one caller.
- **No backwards-compatibility shims** for code that has not yet shipped. If you are reshaping an internal API in the same PR, just reshape it.
- **Trust internal callers.** Validate at boundaries (CLI argv, config files, provider responses) — not in every function.
- **Imports.** Group: node built-ins → third-party → first-party `./...`. No circular imports.
- **Errors** thrown to users (CLI or runtime API) must be actionable: state what went wrong and what the user can do.

If you are unsure whether something fits, open the PR and ask — we would rather discuss than have you guess.

---

## Testing

We use **Vitest**.

```bash
npm run test --workspace arrey-cli
```

Test files sit next to the code they cover, e.g.:

- [cli/src/runtime/create-runtime.test.ts](cli/src/runtime/create-runtime.test.ts)
- [cli/src/runtime/provider-factory.test.ts](cli/src/runtime/provider-factory.test.ts)
- [cli/src/runtime/tool-loader.test.ts](cli/src/runtime/tool-loader.test.ts)
- [cli/src/commands/commands.integration.test.ts](cli/src/commands/commands.integration.test.ts)

Guidelines:

- Use **integration tests** for CLI commands — invoke them in a temp directory and assert filesystem effects.
- Use **unit tests** for the runtime — mock providers via the provider-factory seam.
- Do **not** mock things you can construct cheaply. Real config objects, real chunkers, real loaders.
- Tests must be deterministic. No real network calls.

---

## Adding a new registry tool

A "registry tool" is a tool template that users install via `arrey add <tool>`.

### 1. Create the directory

```text
registry/<tool>/
  index.ts
  prompt.ts
  manifest.json
  README.md
```

Use [registry/summarize/](registry/summarize/) as the reference implementation.

### 2. Implement `index.ts`

Export a `run(input, ctx)` function and a convenience function:

```ts
import type { ArreyContext } from "arrey-cli";
import { prompts } from "./prompt";

export interface MyToolInput { /* ... */ }
export interface MyToolOutput { /* ... */ }

export async function run(input: MyToolInput, ctx: ArreyContext): Promise<MyToolOutput> {
  // use ctx.complete, ctx.chunk, ctx.log
}

export async function myTool(props: MyToolCallProps): Promise<MyToolOutput> {
  const { arrey } = await import("arrey-cli");
  return arrey.run<MyToolInput, MyToolOutput>("my-tool", { /* ... */ });
}

(myTool as typeof myTool & { arreyToolName?: string }).arreyToolName = "my-tool";
```

### 3. Write `prompt.ts`

Export a `prompts` object containing every prompt template. Keep prompts editable — users will tweak these.

### 4. Write `manifest.json`

```json
{
  "name": "my-tool",
  "version": "1.0.0",
  "description": "...",
  "arrey": ">=1.0.0",
  "input":  { "field": "string" },
  "output": { "result": "string" },
  "composes": [],
  "optionalDeps": [],
  "examples": [ /* ... */ ]
}
```

### 5. Write `README.md`

Mirror the structure of [registry/summarize/README.md](registry/summarize/README.md) — usage examples (CLI, SDK, direct import, agent framework), customization notes, and a "Files" table.

### 6. Register the tool

Add the tool name to [registry/tools.json](registry/tools.json):

```json
[
  "extract",
  "summarize",
  "transcribe",
  "my-tool"
]
```

### 7. Test

Run `arrey add my-tool` against the local build (`node cli/dist/cli.js add my-tool`) inside a scratch project and exercise it end-to-end.

---

## Adding a new provider

Providers live in [cli/src/runtime/providers/](cli/src/runtime/providers/). To add one:

1. Create `cli/src/runtime/providers/<name>.ts` exporting an `ArreyProvider` factory.
2. Wire it into the provider factory ([cli/src/runtime/provider-factory.ts](cli/src/runtime/provider-factory.ts)).
3. Add the SDK as an **optional peer dependency** in [cli/package.json](cli/package.json) — never as a regular dependency.
4. Lazy-load the SDK inside the provider factory so users without it pay no install cost.
5. Add tests covering: missing SDK error message, basic completion, model override, error mapping.

---

## Commit messages

Use short, imperative subject lines:

```text
add: classify tool to registry
fix: resolve config when projectRoot is set after init
docs: clarify per-tool model override
refactor: extract tool-loader from executor
test: cover provider factory fallback
```

Keep the body wrapped at ~72 chars. Explain *why*, not *what* — the diff already shows the what.

## Pull requests

A good PR:

- Has a descriptive title
- Links the issue it closes (`Closes #123`)
- Explains the motivation in the description
- Stays under ~400 changed lines where possible — split larger work into a series of PRs
- Passes CI: build + tests
- Updates docs if behavior changed

We may ask for changes. That is normal — please do not take it personally. The goal is to keep the codebase small, predictable, and easy for the next contributor.

## Releasing

(Maintainers only.)

1. Bump the version in [cli/package.json](cli/package.json).
2. Update the CHANGELOG.
3. Tag the release: `git tag vX.Y.Z && git push --tags`.
4. Publish: `cd cli && npm publish` (the `prepublishOnly` script runs the build).

## Reporting bugs

Open a [GitHub issue](../../issues/new) with:

- Arrey version (`arrey --version`)
- Node version (`node --version`)
- OS
- A minimal reproduction — the smaller the better
- What you expected, and what actually happened (full error output, including stack)

If the bug is provider-specific, include the provider name and model.

## Requesting features

Open an issue describing:

- The use case — what are you trying to build?
- Why existing primitives are not enough
- A rough proposal for the API or behavior

Feature requests that come with a rough PR sketch are far more likely to land quickly.

---

Thanks again — every contribution, however small, makes Arrey better.
