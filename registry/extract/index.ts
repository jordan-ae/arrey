// ─────────────────────────────────────────────────────────────
// arrey/tools/extract/index.ts


import type { ArreyContext, RunOptions } from "arrey";
import { prompts } from "./prompt";

// ─── Input / Output types ────────────────────────────────────

export interface ExtractInput {
  /** Text content, file path, or URL to extract from */
  content: string;

  /** Output format style for extracted results */
  format?: "bullets" | "json" | "table" | "custom";

  /** Limit the final output to the top N extracted items */
  maxItems?: number;

  /** Extra instruction appended to extraction prompts */
  instruction?: string;
}

export interface ExtractOutput {
  extraction: string;
  format: string;
  chunks: number;
  model: string;
}

/**
 * Convenience API for direct imports:
 * import { extract } from "./arrey/tools/extract";
 */
export interface ExtractCallProps {
  /** Alias for content to make call sites read naturally. */
  prompt: string;
  format?: ExtractInput["format"];
  maxItems?: number;
  instruction?: string;
  temp?: number;
  temperature?: number;
  model?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

// ─── Main ────────────────────────────────────────────────────

export async function run(input: ExtractInput, ctx: ArreyContext): Promise<ExtractOutput> {
  const format = input.format ?? "bullets";

  ctx.log.info("extract: starting", {
    format,
    contentLength: input.content.length
  });

  // 1. Resolve content (text | filepath | url)
  const content = await resolveContent(input.content, ctx);

  // 2. Split large content into semantic chunks
  const chunks = await ctx.chunk(content, {
    strategy: "semantic",
    maxTokens: 1800,
    overlap: 180,
    preserveHeaders: true
  });

  ctx.log.debug("extract: chunk count", { chunks: chunks.length });

  // 3. Extract from each chunk
  const partials = await Promise.all(
    chunks.map((chunk, index) =>
      ctx.complete(prompts.chunk, {
        index: index + 1,
        total: chunks.length,
        content: chunk,
        instruction: input.instruction ?? ""
      })
    )
  );

  // 4. Combine chunk-level extractions
  let extraction: string;
  if (partials.length === 1) {
    extraction = partials[0];
  } else {
    const formatPrompt = prompts.formats[format] ?? prompts.formats.bullets;
    extraction = await ctx.complete(prompts.combine, {
      count: partials.length,
      extractions: partials.join("\n\n---\n\n"),
      format: formatPrompt,
      instruction: input.instruction ?? ""
    });
  }

  // 5. Limit extracted items if requested
  if (input.maxItems) {
    extraction = await ctx.complete(prompts.limit, {
      extraction,
      maxItems: input.maxItems
    });
  }

  return {
    extraction,
    format,
    chunks: chunks.length,
    model: ctx.config.provider.model ?? "unknown"
  };
}

// ─── Content Resolution ──────────────────────────────────────

async function resolveContent(input: string, ctx: ArreyContext): Promise<string> {
  // URL
  if (input.startsWith("http://") || input.startsWith("https://")) {
    ctx.log.debug("extract: fetching URL", { url: input });
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${input}`);
    }
    return response.text();
  }

  // File path
  if (input.includes("/") || input.includes("\\") || input.includes(".")) {
    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    if (existsSync(input)) {
      ctx.log.debug("extract: reading file", { path: input });
      return readFile(input, "utf8");
    }
  }

  // Plain text
  return input;
}

function toRunOptions(props: ExtractCallProps): RunOptions | undefined {
  const runOptions: RunOptions = {};
  const temperature = props.temperature ?? props.temp;

  if (typeof temperature === "number") {
    runOptions.temperature = temperature;
  }
  if (typeof props.model === "string" && props.model.length > 0) {
    runOptions.model = props.model;
  }
  if (typeof props.maxTokens === "number") {
    runOptions.maxTokens = props.maxTokens;
  }
  if (Array.isArray(props.stopSequences)) {
    runOptions.stopSequences = props.stopSequences;
  }

  return Object.keys(runOptions).length > 0 ? runOptions : undefined;
}

export async function extract(props: ExtractCallProps): Promise<ExtractOutput> {
  const { arrey } = await import("arrey");
  return arrey.run<ExtractInput, ExtractOutput>(
    "extract",
    {
      content: props.prompt,
      format: props.format,
      maxItems: props.maxItems,
      instruction: props.instruction
    },
    toRunOptions(props)
  );
}

(extract as typeof extract & { arreyToolName?: string }).arreyToolName = "extract";
