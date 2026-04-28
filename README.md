# Arrey

> Install production-ready AI tools as editable code.

Arrey is a modular, model-agnostic toolkit for AI tools. You install only the tools you need, and each tool lands in your project as editable source code — not hidden behind opaque package internals. Inspired by the same ownership model as shadcn/ui.

[![npm version](https://img.shields.io/npm/v/arrey-cli.svg)](https://www.npmjs.com/package/arrey-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

---

## Table of contents

- [What Arrey is](#what-arrey-is)
- [Why this project exists](#why-this-project-exists)
- [Capabilities](#capabilities)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Framework adapters](#framework-adapters)
- [Tool contract](#tool-contract)
- [CLI reference](#cli-reference)
- [Local development](#local-development)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What Arrey is

- A **CLI** for initializing and managing local tool code in [arrey/tools/](arrey/tools/)
- A **runtime** that injects a single `ArreyContext` into tools
- A **provider layer** that switches between OpenAI, Anthropic, Ollama, Azure, or custom implementations
- An **adapter layer** that exposes installed tools to agent frameworks (Vercel AI SDK, LangChain-compatible JSON, etc.)

## Why this project exists

Most agent projects rebuild the same primitives over and over: summarize, extract, classify, transcribe, translate, routing helpers, and so on. Arrey standardizes the contract for these primitives while keeping the implementation fully **user-owned and customizable**. The code is yours — fork, edit, and ship.

## Capabilities

- CLI commands: `init`, `add`, `install`, `list`
- Canonical per-tool layout: [index.ts](registry/summarize/index.ts), [prompt.ts](registry/summarize/prompt.ts), [manifest.json](registry/summarize/manifest.json), [README.md](registry/summarize/README.md)
- Runtime execution via `arrey.run(toolName, input)`
- Framework adapters:
  - `arrey.toVercelAI([...])` / `arrey.toVercelAIFrom([...])`
  - `arrey.toJSON([...])` / `arrey.toJSONFrom([...])` for custom framework integrations
- Built-in tools in [registry/](registry/): `summarize`, `extract`, `classify`, `transcribe`, `translate`

---

## Quickstart

### Prerequisites

- Node.js **18+**
- npm, pnpm, or yarn
- An API key for at least one provider (OpenAI, Anthropic, etc.) — set via env vars or the config file

### 1. Initialize a project

In the directory where you want to use Arrey:

```bash
npx arrey-cli@latest init
```

This creates:

- [arrey.config.yaml](arrey.config.yaml) — provider and tool configuration
- [arrey/tools/](arrey/tools/) — where installed tools land

### 2. Add tools

```bash
npx arrey-cli@latest add summarize
npx arrey-cli@latest add extract
npx arrey-cli@latest add transcribe
```

Each `add` command copies the canonical tool source into `arrey/tools/<tool>/`. From this moment on, the code is yours to edit.

### 3. Set your provider key

Either export it:

```bash
export OPENAI_API_KEY="sk-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."
```

…or set it in `arrey.config.yaml` (see [Configuration](#configuration)).

### 4. Use a tool

```ts
import { arrey } from "arrey-cli";

const result = await arrey.run("summarize", {
  content: "Paste text here",
  format: "executive"
});

console.log(result.summary);
```

Or import the tool directly — each installed tool exports a convenience function:

```ts
import { summarize } from "./arrey/tools/summarize";

const result = await summarize({
  prompt: "Paste text here",
  format: "executive",
  temp: 0.4,
  model: "gpt-4o"
});
```

---

## Configuration

Arrey reads [arrey.config.yaml](arrey.config.yaml) from your project root.

```yaml
provider:
  name: openai           # openai | anthropic | ollama | azure | custom
  model: gpt-4o-mini
  # apiKey: "..."        # optional — env vars are preferred
  # endpoint: "..."      # optional — for custom or self-hosted endpoints

tools:
  installed: [summarize, extract]

  # Per-tool overrides — any provider field can be overridden
  summarize:
    provider:
      model: gpt-4o
```

Notes:

- Provider SDKs (`openai`, `@anthropic-ai/sdk`) are **optional peer dependencies** — they are lazy-loaded only when used.
- Experimental tools are excluded from adapter auto-discovery unless explicitly listed.
- Per-tool overrides win over the global `provider` block.

---

## Framework adapters

### Vercel AI SDK

```ts
import { arrey } from "arrey-cli";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { summarize } from "./arrey/tools/summarize";
import { extract } from "./arrey/tools/extract";

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools: await arrey.toVercelAIFrom([summarize, extract]),
  prompt: "Summarize this report and extract key risks."
});
```

### Custom frameworks (JSON tool definitions)

```ts
import { arrey } from "arrey-cli";
import { summarize } from "./arrey/tools/summarize";
import { extract } from "./arrey/tools/extract";

const tools = await arrey.toJSONFrom([summarize, extract]);
// Map `tools` into your framework's tool format
```

The `toJSON` output is a plain object keyed by tool name with JSON-Schema-style input/output, so it adapts to virtually any agent framework.

---

## Tool contract

Every installed tool follows the same layout:

```text
arrey/tools/<tool>/
  index.ts        # execution logic — exports run(input, ctx) and a convenience function
  prompt.ts       # prompt templates and format definitions
  manifest.json   # metadata + I/O schema (used by adapters)
  README.md       # tool-specific usage and customization notes
```

Inside `index.ts`, your tool receives an `ArreyContext`:

```ts
import type { ArreyContext } from "arrey-cli";

export async function run(input: MyInput, ctx: ArreyContext): Promise<MyOutput> {
  ctx.log.info("starting");

  const chunks = await ctx.chunk(input.content, {
    strategy: "semantic",
    maxTokens: 2000,
    overlap: 200
  });

  const result = await ctx.complete(promptTemplate, { content: chunks[0] });

  return { result, model: ctx.config.provider.model ?? "unknown" };
}
```

The context exposes:

- `ctx.complete(prompt, vars)` — provider-agnostic completion
- `ctx.chunk(text, opts)` — semantic / sentence / fixed / code chunking
- `ctx.log` — structured logger
- `ctx.config` — resolved config for this run

See [registry/summarize/index.ts](registry/summarize/index.ts) for a full reference implementation.

---

## CLI reference

```bash
arrey init                  # scaffold arrey.config.yaml and arrey/tools/
arrey add <tool>            # install a tool from the registry into your project
arrey install               # install all tools listed in arrey.config.yaml
arrey list                  # list installed tools and available registry tools
arrey --help                # full command reference
arrey --version
```

Tools available in the registry today:

- `summarize` — text/file/URL summarization with semantic chunking
- `extract` — structured data extraction
- `classify` — text classification
- `transcribe` — audio → text
- `translate` — language translation

---

## Local development

If you want to hack on Arrey itself (the CLI, runtime, or registry):

```bash
git clone https://github.com/<your-fork>/arrey.git
cd arrey
npm install
```

### Build

```bash
npm run build --workspace arrey-cli
```

### Test

```bash
npm run test --workspace arrey-cli
```

### Watch mode

```bash
npm run dev --workspace arrey-cli
```

### Run the local CLI build

```bash
node cli/dist/cli.js init
node cli/dist/cli.js add summarize
node cli/dist/cli.js list
```

### Linking for end-to-end testing

```bash
cd cli && npm link
cd /path/to/test-project && npm link arrey-cli
```

---

## Project layout

```text
cli/                        # npm package: arrey-cli (runtime, CLI, adapters)
  src/
    cli.ts                  # CLI entrypoint
    index.ts                # public runtime API (arrey.run, arrey.toJSON, ...)
    commands/               # init | add | install | list
    core/                   # installer, registry, project-config, layout, logger
    runtime/                # executor, providers, schema, context-factory
registry/                   # tool templates copied into user projects
  tools.json                # registry index
  summarize/                # canonical tool: index.ts, prompt.ts, manifest.json, README.md
  extract/
  classify/
  transcribe/
  translate/
```

---

## Troubleshooting

**`Provider SDK not found` on first run**
Provider SDKs are optional peer dependencies. Install the one you use:

```bash
npm install openai          # for provider: openai
npm install @anthropic-ai/sdk   # for provider: anthropic
```

**`Cannot find module './arrey/tools/<tool>'`**
The tool was not installed yet. Run `arrey add <tool>` (or `arrey install` if it is listed in `arrey.config.yaml`).

**Per-tool model override is ignored**
Make sure the override sits under `tools.<tool>.provider`, not directly under `tools.<tool>`. The config resolver only merges keys nested under `provider`.

**Tool not appearing in `toVercelAI()` output**
Tools marked experimental are excluded from auto-discovery. Pass them explicitly via `arrey.toVercelAIFrom([myTool])`, or list them under `tools.installed` in the config.

---

## Contributing

Contributions are welcome — bug fixes, new tools for the registry, provider adapters, docs improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow, coding conventions, and how to add a new tool to the registry.

Quick links:

- File a bug or request a feature: open a [GitHub issue](../../issues)
- Submit changes: open a pull request against `main`
- Add a new tool: see the [Adding a new registry tool](CONTRIBUTING.md#adding-a-new-registry-tool) section

## License

[MIT](LICENSE)
