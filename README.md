# Arrey

Arrey is a modular, model-agnostic toolkit for AI tools.

You install only the tools you need, and each tool lands in your project as editable source code. Arrey is inspired by the same ownership model as shadcn/ui: code is copied into your app, not hidden behind opaque package internals.

## What Arrey is

- A CLI for initializing and managing local tool code in `arrey/tools/*`
- A runtime that injects a single `ArreyContext` into tools
- A provider layer that can switch between OpenAI, Anthropic, Ollama, Azure, or custom implementations
- An adapter layer so the same installed tools can be exposed to agent frameworks

## Why this project exists

Most agent projects rebuild the same primitives repeatedly: summarize, extract, validate, routing helpers, and so on. Arrey standardizes tool contracts while keeping tool logic fully user-owned and customizable.

## Current capabilities in this repo

- CLI commands: `init`, `add`, `install`, `list`
- Canonical tool layout with required files
- Runtime execution via `arrey.run(toolName, input)`
- Framework adapters:
  - `arrey.toVercelAI([...])`
  - `arrey.toJSON([...])` for custom framework integrations

## Quickstart (using Arrey in your project)

### 1. Initialize

```bash
npx arrey@latest init
```

This creates:

- `arrey.config.yaml`
- `arrey/tools/`

### 2. Add tools

```bash
npx arrey@latest add summarize
npx arrey@latest add extract
npx arrey@latest add transcribe
```

### 3. Use tools in your own agent code

```ts
import { arrey } from "arrey";

const result = await arrey.run("summarize", {
  content: "Paste text here",
  format: "executive"
});

console.log(result);
```

If you prefer direct per-tool imports, each installed tool also exports a convenience
function from its own `index.ts`:

```ts
import { summarize } from "./arrey/tools/summarize";

const result = await summarize({
  prompt: "Paste text here",
  format: "executive",
  temp: 0.4,
  model: "gpt-5.4"
});
```

### 4. Use with frameworks

#### Vercel AI SDK

```ts
import { arrey } from "arrey";
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

#### Custom frameworks

```ts
import { arrey } from "arrey";
import { summarize } from "./arrey/tools/summarize";
import { extract } from "./arrey/tools/extract";

const tools = await arrey.toJSONFrom([summarize, extract]);
// Map `tools` into your framework's tool format
```

## Configuration

Arrey reads `arrey.config.yaml` from your project root.

```yaml
provider:
  name: openai
  model: gpt-4o-mini
  # apiKey: "..."          # optional, can use env vars instead
  # endpoint: "..."        # optional for custom/base endpoints

tools:
  installed: [summarize, extract]

  summarize:
    provider:
      model: gpt-4o
```

Notes:

- Experimental tools are excluded from adapter auto-discovery unless explicitly requested.
- Provider SDK packages are optional peer dependencies and are lazy-loaded only when needed.

## Canonical tool contract

Installed tools use this structure:

```text
arrey/tools/<tool>/
  index.ts
  prompt.ts
  manifest.json
  README.md
```

- `index.ts`: execution logic (`run(input, ctx)`)
- `prompt.ts`: prompt templates and format instructions
- `manifest.json`: tool metadata and input/output schema
- `README.md`: tool-specific usage and customization notes

## Running this repository locally

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build --workspace arrey
```

### Test

```bash
npm run test --workspace arrey
```

### Watch mode while developing

```bash
npm run dev --workspace arrey
```

### Run the local CLI build

```bash
node cli/dist/cli.js init
node cli/dist/cli.js add summarize
node cli/dist/cli.js list
```

## User-facing docs website

The website and docs live in `../web-site` and are built with Next.js + Tailwind.

Tool documentation is auto-generated from registry source files:

- `registry/tools.json`
- `registry/<tool>/manifest.json`
- `registry/<tool>/README.md`

When a new tool is added to the registry, it appears in docs automatically on the
next website `dev` or `build` run (via `npm run docs:sync` in `web-site`).

## Repository layout

```text
cli/                  # npm package: arrey (runtime, CLI, adapters)
registry/             # tool templates copied into user projects
```

## License

MIT
