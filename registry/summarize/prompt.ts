// ─────────────────────────────────────────────────────────────
// arrey/tools/summarize/prompt.ts

export const prompts = {
  /**
   * Used when processing each chunk of a long document.
   * {{index}} and {{total}} let the model know where it is in the document.
   * {{instruction}} is the optional user instruction passed to run().
   */
  chunk: `
You are summarizing part {{index}} of {{total}} of a document.
Extract only the key points from this section.
Do not write conclusions, transitions, or references to other sections.
Be concise. Maximum 200 words.
{{instruction}}

Content:
{{content}}
  `.trim(),

  /**
   * Used when combining multiple chunk summaries into one final summary.
   * {{format}} is injected from the formats object below.
   */
  combine: `
You have {{count}} partial summaries from different sections of a document.
Combine them into a single coherent summary. Remove duplication.
Do not add information that wasn't in the summaries.
{{format}}
{{instruction}}

Summaries:
{{summaries}}
  `.trim(),

  /**
   * Used only when the user passes maxWords.
   * Trims the summary to the target word count without losing key points.
   */
  truncate: `
Shorten the following summary to {{maxWords}} words or fewer.
Preserve the most important points. Do not add new information.

Summary:
{{summary}}
  `.trim(),

  /**
   * Format instructions injected into the combine prompt.
   * Edit these to change what each format produces.
   * Add new formats here and pass them as: arrey summarize --format yourformat
   */
  formats: {
    bullets: `
Format the output as 5 to 7 bullet points.
Each bullet must be a single complete sentence.
Start each bullet with a strong verb where possible.
Do not use sub-bullets.
    `.trim(),

    tldr: `
Format the output as a single paragraph under 100 words.
Write in plain English. Avoid jargon.
The first sentence should be the single most important takeaway.
    `.trim(),

    executive: `
Format the output in exactly three sections with these headers:

OVERVIEW
Two sentences maximum. What is this document about and why does it matter.

KEY POINTS
Three to five bullet points. Most important findings or decisions only.

RECOMMENDATION
One sentence. The single most important action to take based on this document.
    `.trim(),

    /**
     * Define your own format here.
     * Use it with: arrey summarize --format custom
     * Or in code:  arrey.run('summarize', { ... , format: 'custom' })
     */
    custom: `
Write the summary in your own custom format here.
    `.trim()
  }
};
