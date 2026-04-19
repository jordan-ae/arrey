// ─────────────────────────────────────────────────────────────
// arrey/tools/extract/prompt.ts

export const prompts = {
  /**
   * Used for chunk-level extraction when content is large.
   */
  chunk: `
You are extracting structured facts from part {{index}} of {{total}}.
Capture only concrete information from this section.
Avoid assumptions and avoid filler language.
{{instruction}}

Section:
{{content}}
  `.trim(),

  /**
   * Used to merge chunk-level extraction into one final result.
   */
  combine: `
You have {{count}} partial extraction outputs.
Merge them into one coherent result and deduplicate repeated facts.
Do not invent information.
{{format}}
{{instruction}}

Partials:
{{extractions}}
  `.trim(),

  /**
   * Used when maxItems is provided.
   */
  limit: `
Reduce the extraction to {{maxItems}} items or fewer.
Keep only the most important facts.
Do not add information.

Extraction:
{{extraction}}
  `.trim(),

  /**
   * Output format instructions injected into combine.
   */
  formats: {
    bullets: `
Return 5 to 10 concise bullet points.
Each bullet should contain one distinct fact.
    `.trim(),

    json: `
Return valid JSON as an array of objects.
Each object must contain: "fact" and "confidence".
"confidence" must be one of: high, medium, low.
    `.trim(),

    table: `
Return a markdown table with columns:
Fact | Evidence
Each row must map one fact to direct supporting evidence.
    `.trim(),

    custom: `
Write extraction output in your custom format.
    `.trim()
  }
};
