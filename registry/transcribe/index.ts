// ─────────────────────────────────────────────────────────────
// arrey/tools/transcribe/index.ts

import type { ArreyContext, RunOptions } from "arrey";
import { prompts } from "./prompt";

// ─── Input / Output types ────────────────────────────────────

export interface TranscribeInput {
  /** Public URL to an audio file */
  audioUrl: string;

  /** ISO language code e.g. en, fr */
  language?: string;

  /** Optional instruction to improve transcription style */
  instruction?: string;

  /** Whether to run a cleanup pass on the transcript */
  clean?: boolean;
}

export interface TranscribeOutput {
  transcript: string;
  model: string;
  language?: string;
}

/**
 * Convenience API for direct imports:
 * import { transcribe } from "./arrey/tools/transcribe";
 */
export interface TranscribeCallProps {
  audioUrl: string;
  language?: string;
  instruction?: string;
  clean?: boolean;
  temp?: number;
  temperature?: number;
  model?: string;
  maxTokens?: number;
  stopSequences?: string[];
}

// ─── Main ────────────────────────────────────────────────────

export async function run(
  input: TranscribeInput,
  ctx: ArreyContext
): Promise<TranscribeOutput> {
  ctx.log.info("transcribe: starting", {
    audioUrl: input.audioUrl,
    language: input.language ?? "auto"
  });

  const provider = ctx.config.provider;
  if (!provider.apiKey) {
    throw new Error("transcribe: provider.apiKey is required.");
  }

  const endpoint = toTranscribeEndpoint(provider.endpoint);
  const model = provider.model ?? "gpt-4o-mini-transcribe";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      audio_url: input.audioUrl,
      language: input.language,
      prompt: input.instruction ?? prompts.system
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`transcribe: request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as { text?: string; language?: string };
  if (!payload.text) {
    throw new Error("transcribe: response did not include a text field.");
  }

  let transcript = payload.text;

  if (input.clean ?? true) {
    transcript = await ctx.complete(prompts.cleanup, {
      transcript,
      instruction: input.instruction ?? ""
    });
  }

  return {
    transcript,
    model,
    language: payload.language ?? input.language
  };
}

function toTranscribeEndpoint(endpoint?: string): string {
  const base = (endpoint ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${base}/audio/transcriptions`;
}

function toRunOptions(props: TranscribeCallProps): RunOptions | undefined {
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

export async function transcribe(props: TranscribeCallProps): Promise<TranscribeOutput> {
  const { arrey } = await import("arrey");
  return arrey.run<TranscribeInput, TranscribeOutput>(
    "transcribe",
    {
      audioUrl: props.audioUrl,
      language: props.language,
      instruction: props.instruction,
      clean: props.clean
    },
    toRunOptions(props)
  );
}

(transcribe as typeof transcribe & { arreyToolName?: string }).arreyToolName = "transcribe";
