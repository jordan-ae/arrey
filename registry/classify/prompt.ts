// ─────────────────────────────────────────────────────────────
// arrey/tools/classify/prompt.ts

export const prompts = {
  /**
   * Used when exactly one label must be chosen.
   * {{labels}} is a bullet list of candidates.
   * {{content}} is the text to classify.
   * {{instruction}} is the optional user instruction.
   *
   * The prompt requires strict JSON so parsing is reliable.
   */
  singleLabel: `
You are a strict classifier. Choose EXACTLY ONE label from the list below
that best describes the content. Do not invent new labels.
Do not return labels that are not in the list.

Labels:
{{labels}}

{{instruction}}

Content:
{{content}}

Respond with JSON ONLY, no commentary, in this exact shape:
{
  "label": "<one label from the list>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one short sentence explaining why>"
}
  `.trim(),

  /**
   * Used when the content may belong to multiple labels.
   * Returns a JSON array ordered by relevance.
   */
  multiLabel: `
You are a strict multi-label classifier. Choose every label from the list below
that clearly applies to the content. Do not invent new labels.
Order the results from most relevant to least relevant.
If no label applies with at least low confidence, return an empty array.

Labels:
{{labels}}

{{instruction}}

Content:
{{content}}

Respond with JSON ONLY, no commentary, in this exact shape:
[
  {
    "label": "<one label from the list>",
    "confidence": "high" | "medium" | "low",
    "reasoning": "<one short sentence>"
  }
]
  `.trim()
};
