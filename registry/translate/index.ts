// ─────────────────────────────────────────────────────────────
// arrey/tools/translate/index.ts


import type { ArreyContext, RunOptions } from "arrey";
import { prompts } from "./prompt";

// ─── Input / Output types ────────────────────────────────────

export interface TranslateInput {
  /** Text content, file path, or URL to translate */
  content: string;

  /** Target language. ISO code (e.g. "es") or name (e.g. "Spanish") */
  targetLang: string;

  /** Source language. Auto-detected if omitted */
  sourceLang?: string;

  /**
   * Output tone.
   * 'neutral' → accurate, plain, no editorial choices (default)
   * 'formal'  → polite register, suitable for business
   * 'casual'  → everyday conversation
   * 'literal' → prioritize word-for-word fidelity over flow
   */
  tone?: "neutral" | "formal" | "casual" | "literal";

  /**
   * Glossary of terms that must be preserved or translated a specific way.
   * Example: { "arrey": "arrey", "customer": "cliente" }
   */
  glossary?: Record<string, string>;

  /** Extra instruction appended to the translate prompt */
  instruction?: string;
}

export interface TranslateOutput {
  translation: string;
  sourceLang: string;
  targetLang: string;
  tone: string;
  chunks: number;
  model: string;
}

export interface TranslateCallProps {
  prompt: string;
  targetLang: string;
  sourceLang?: string;
  tone?: TranslateInput["tone"];
  glossary?: Record<string, string>;
  instruction?: string;
  temp?: number;
  temperature?: number;
  model?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

// ─── Main ────────────────────────────────────────────────────

export async function run(
  input: TranslateInput,
  ctx: ArreyContext
): Promise<TranslateOutput> {
  if (!input.targetLang) {
    throw new Error("translate: targetLang is required.");
  }

  const tone = input.tone ?? "neutral";

  ctx.log.info("translate: starting", {
    targetLang: input.targetLang,
    sourceLang: input.sourceLang ?? "auto",
    tone
  });

  // 1. Resolve content (text | filepath | url)
  const content = await resolveContent(input.content, ctx);

  // 2. Chunk on paragraph boundaries so we don't split sentences mid-clause
  const chunks = await ctx.chunk(content, {
    strategy: "semantic",
    maxTokens: 1500,
    overlap: 0,
    preserveHeaders: true
  });

  ctx.log.debug("translate: chunk count", { chunks: chunks.length });

  // 3. Build the glossary block once
  const glossary = formatGlossary(input.glossary);

  // 4. Translate each chunk independently with temperature 0 for consistency
  const toneGuidance = prompts.tones[tone] ?? prompts.tones.neutral;

  const parts = await Promise.all(
    chunks.map((chunk) =>
      ctx.complete(
        prompts.translate,
        {
          content: chunk,
          targetLang: input.targetLang,
          sourceLang: input.sourceLang ?? "auto-detect",
          tone: toneGuidance,
          glossary,
          instruction: input.instruction ?? ""
        },
        { temperature: 0 }
      )
    )
  );

  // 5. Re-join chunks. Paragraph-level chunks concatenate cleanly with double newlines.
  const translation = parts.join("\n\n").trim();

  return {
    translation,
    sourceLang: input.sourceLang ?? "auto",
    targetLang: input.targetLang,
    tone,
    chunks: chunks.length,
    model: ctx.config.provider.model ?? "unknown"
  };
}

// ─── Content Resolution ──────────────────────────────────────

async function resolveContent(input: string, ctx: ArreyContext): Promise<string> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    ctx.log.debug("translate: fetching URL", { url: input });
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${input}`);
    }
    return response.text();
  }

  if (input.includes("/") || input.includes("\\") || input.includes(".")) {
    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    if (existsSync(input)) {
      ctx.log.debug("translate: reading file", { path: input });
      return readFile(input, "utf8");
    }
  }

  return input;
}

function formatGlossary(glossary?: Record<string, string>): string {
  if (!glossary || Object.keys(glossary).length === 0) {
    return "None.";
  }
  return Object.entries(glossary)
    .map(([source, target]) => `- "${source}" → "${target}"`)
    .join("\n");
}

// ─── Convenience API ─────────────────────────────────────────

function toRunOptions(props: TranslateCallProps): RunOptions | undefined {
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

export async function translate(props: TranslateCallProps): Promise<TranslateOutput> {
  const { arrey } = await import("arrey");
  return arrey.run<TranslateInput, TranslateOutput>(
    "translate",
    {
      content: props.prompt,
      targetLang: props.targetLang,
      sourceLang: props.sourceLang,
      tone: props.tone,
      glossary: props.glossary,
      instruction: props.instruction
    },
    toRunOptions(props)
  );
}

(translate as typeof translate & { arreyToolName?: string }).arreyToolName = "translate";
