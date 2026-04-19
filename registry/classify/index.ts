// ─────────────────────────────────────────────────────────────
// arrey/tools/classify/index.ts
//
// This file is the execution logic for the classify tool.
// ─────────────────────────────────────────────────────────────

import type { ArreyContext, RunOptions } from "arrey";
import { prompts } from "./prompt";

// ─── Input / Output types ────────────────────────────────────

export interface ClassifyInput {
  /** Text content, file path, or URL to classify */
  content: string;

  /** The set of candidate labels to choose from */
  labels: string[];

  /**
   * If true, the model may return more than one label.
   * If false (default), the model returns exactly one.
   */
  multiLabel?: boolean;

  /** Optional descriptions for labels to disambiguate them */
  labelDescriptions?: Record<string, string>;

  /** Extra instruction appended to the classification prompt */
  instruction?: string;
}

export interface ClassifyResult {
  label: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export interface ClassifyOutput {
  results: ClassifyResult[];
  topLabel: string;
  multiLabel: boolean;
  model: string;
}

export interface ClassifyCallProps {
  prompt: string;
  labels: string[];
  multiLabel?: boolean;
  labelDescriptions?: Record<string, string>;
  instruction?: string;
  temp?: number;
  temperature?: number;
  model?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

// ─── Main ────────────────────────────────────────────────────

export async function run(
  input: ClassifyInput,
  ctx: ArreyContext
): Promise<ClassifyOutput> {
  if (!Array.isArray(input.labels) || input.labels.length === 0) {
    throw new Error("classify: labels must be a non-empty string array.");
  }

  ctx.log.info("classify: starting", {
    labelCount: input.labels.length,
    multiLabel: input.multiLabel ?? false
  });

  // 1. Resolve content (text | filepath | url)
  const content = await resolveContent(input.content, ctx);

  // 2. Build a deterministic label list for the prompt
  const labelList = input.labels
    .map((label) => {
      const description = input.labelDescriptions?.[label];
      return description ? `- ${label}: ${description}` : `- ${label}`;
    })
    .join("\n");

  // 3. Run classification
  const promptTemplate = input.multiLabel ? prompts.multiLabel : prompts.singleLabel;
  const raw = await ctx.complete(
    promptTemplate,
    {
      content,
      labels: labelList,
      instruction: input.instruction ?? ""
    },
    { temperature: 0 }
  );

  // 4. Parse the response into structured results
  const results = parseResults(raw, input.labels);

  if (results.length === 0) {
    throw new Error("classify: model did not return any recognized label.");
  }

  return {
    results,
    topLabel: results[0].label,
    multiLabel: input.multiLabel ?? false,
    model: ctx.config.provider.model ?? "unknown"
  };
}

// ─── Content Resolution ──────────────────────────────────────

async function resolveContent(input: string, ctx: ArreyContext): Promise<string> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    ctx.log.debug("classify: fetching URL", { url: input });
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
      ctx.log.debug("classify: reading file", { path: input });
      return readFile(input, "utf8");
    }
  }

  return input;
}

// ─── Response Parsing ────────────────────────────────────────

function parseResults(raw: string, validLabels: string[]): ClassifyResult[] {
  // Try JSON first — the prompt asks for JSON output
  const jsonBlock = extractJsonBlock(raw);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock);
      const array = Array.isArray(parsed) ? parsed : [parsed];
      const valid = array
        .map((item) => normalizeResult(item, validLabels))
        .filter((item): item is ClassifyResult => item !== null);
      if (valid.length > 0) {
        return valid;
      }
    } catch {
      // fall through to text matching
    }
  }

  // Fallback: find the first label name in the raw output
  const found = validLabels.find((label) =>
    raw.toLowerCase().includes(label.toLowerCase())
  );
  if (found) {
    return [{ label: found, confidence: "low", reasoning: raw.trim() }];
  }

  return [];
}

function extractJsonBlock(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];
  return null;
}

function normalizeResult(item: unknown, validLabels: string[]): ClassifyResult | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const rawLabel = typeof rec.label === "string" ? rec.label : "";
  const matched = validLabels.find(
    (label) => label.toLowerCase() === rawLabel.toLowerCase()
  );
  if (!matched) return null;

  const confidenceRaw = typeof rec.confidence === "string" ? rec.confidence.toLowerCase() : "medium";
  const confidence: ClassifyResult["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";

  const reasoning = typeof rec.reasoning === "string" ? rec.reasoning : "";
  return { label: matched, confidence, reasoning };
}

// ─── Convenience API ─────────────────────────────────────────

function toRunOptions(props: ClassifyCallProps): RunOptions | undefined {
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

export async function classify(props: ClassifyCallProps): Promise<ClassifyOutput> {
  const { arrey } = await import("arrey");
  return arrey.run<ClassifyInput, ClassifyOutput>(
    "classify",
    {
      content: props.prompt,
      labels: props.labels,
      multiLabel: props.multiLabel,
      labelDescriptions: props.labelDescriptions,
      instruction: props.instruction
    },
    toRunOptions(props)
  );
}

(classify as typeof classify & { arreyToolName?: string }).arreyToolName = "classify";
