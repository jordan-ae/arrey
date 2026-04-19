// ─────────────────────────────────────────────────────────────
// arrey/tools/summarize/index.ts

import type { ArreyContext, RunOptions } from "arrey";
import { prompts } from "./prompt";

// ─── Input / Output types ────────────────────────────────────

export interface SummarizeInput {
  /** Text content, a file path, or a URL to summarize */
  content: string;

  /**
   * Output format.
   * 'bullets'   → 5-7 bullet points
   * 'tldr'      → one paragraph under 100 words
   * 'executive' → structured with Overview, Key Points, Recommendation
   * 'custom'    → use prompts.formats.custom (you define it in prompt.ts)
   */
  format?: "bullets" | "tldr" | "executive" | "custom";

  /** Target word count for the final summary. Optional. */
  maxWords?: number;

  /** Extra instruction appended to the final prompt. Useful for domain context. */
  instruction?: string;
}

export interface SummarizeOutput {
  summary: string;
  format: string;
  wordCount: number;
  chunks: number;
  model: string;
}

/**
 * Convenience API for direct imports:
 * import { summarize } from "./arrey/tools/summarize";
 */
export interface SummarizeCallProps {
  /** Alias for content to make call sites read naturally. */
  prompt: string;
  format?: SummarizeInput["format"];
  maxWords?: number;
  instruction?: string;
  /** Temperature alias. */
  temp?: number;
  /** Preferred explicit temperature field. */
  temperature?: number;
  model?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

// ─── Main ────────────────────────────────────────────────────

export async function run(
  input: SummarizeInput,
  ctx: ArreyContext
): Promise<SummarizeOutput> {
  const format = input.format ?? "bullets";

  ctx.log.info("summarize: starting", {
    format,
    contentLength: input.content.length
  });

  // 1. Resolve content (text | filepath | url)
  const content = await resolveContent(input.content, ctx);

  // 2. Split into chunks the model can handle
  const chunks = await ctx.chunk(content, {
    strategy: "semantic",
    maxTokens: 2000,
    overlap: 200,
    preserveHeaders: true
  });

  ctx.log.debug("summarize: chunk count", { chunks: chunks.length });

  // 3. Summarize each chunk independently
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

  // 4. If only one chunk, skip the combine step
  let summary: string;

  if (partials.length === 1) {
    summary = partials[0];
  } else {
    // 5. Combine partial summaries into the final output
    const formatPrompt = prompts.formats[format] ?? prompts.formats.bullets;
    summary = await ctx.complete(prompts.combine, {
      count: partials.length,
      summaries: partials.join("\n\n---\n\n"),
      format: formatPrompt,
      instruction: input.instruction ?? ""
    });
  }

  // 6. Enforce word count limit if requested
  if (input.maxWords) {
    summary = await ctx.complete(prompts.truncate, {
      summary,
      maxWords: input.maxWords
    });
  }

  return {
    summary,
    format,
    wordCount: summary.split(/\s+/).filter(Boolean).length,
    chunks: chunks.length,
    model: ctx.config.provider.model ?? "unknown"
  };
}

// ─── Content Resolution ──────────────────────────────────────

async function resolveContent(input: string, ctx: ArreyContext): Promise<string> {
  // URL
  if (input.startsWith("http://") || input.startsWith("https://")) {
    ctx.log.debug("summarize: fetching URL", { url: input });
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
      ctx.log.debug("summarize: reading file", { path: input });
      return readFile(input, "utf8");
    }
  }

  // Plain text — use as-is
  return input;
}

function toRunOptions(props: SummarizeCallProps): RunOptions | undefined {
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

export async function summarize(props: SummarizeCallProps): Promise<SummarizeOutput> {
  const { arrey } = await import("arrey");
  return arrey.run<SummarizeInput, SummarizeOutput>(
    "summarize",
    {
      content: props.prompt,
      format: props.format,
      maxWords: props.maxWords,
      instruction: props.instruction
    },
    toRunOptions(props)
  );
}

(summarize as typeof summarize & { arreyToolName?: string }).arreyToolName = "summarize";
