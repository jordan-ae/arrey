// ─────────────────────────────────────────────────────────────
// arrey/tools/transcribe/prompt.ts

export const prompts = {
  /**
   * Default provider-side instruction for raw transcription.
   */
  system: `
Transcribe speech accurately.
Preserve punctuation and speaker intent.
Do not summarize.
  `.trim(),

  /**
   * Optional cleanup pass applied through ctx.complete().
   */
  cleanup: `
Clean up the transcript for readability.
Fix punctuation and obvious recognition artifacts.
Preserve meaning and speaker intent exactly.
Do not remove technical terms, names, or numbers.
{{instruction}}

Transcript:
{{transcript}}
  `.trim()
};
