# arrey/tools/summarize

Summarizes text, files, and URLs into configurable formats.
Handles long documents automatically through semantic chunking.
This code is yours - edit it freely.

---

## Usage

### CLI
```bash
arrey summarize ./report.pdf
arrey summarize ./report.pdf --format executive
arrey summarize https://example.com/article --format tldr
arrey summarize "paste any text here" --format bullets
arrey summarize ./contract.pdf --format executive --instruction "Focus on liability clauses"
```

### SDK
```typescript
import { arrey } from 'arrey'

const result = await arrey.run('summarize', {
  content: './report.pdf',
  format: 'executive'
})

console.log(result.summary)
```

### Direct import (tool-local helper)
```typescript
import { summarize } from './arrey/tools/summarize'

const result = await summarize({
  prompt: './report.pdf',
  format: 'executive',
  temp: 0.4,
  model: 'gpt-4.1-mini'
})

console.log(result.summary)
```

### Agent tool (Vercel AI SDK)
```typescript
import { arrey } from 'arrey'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { summarize } from './arrey/tools/summarize'

const { text } = await generateText({
  model: openai('gpt-4o'),
  tools: await arrey.toVercelAIFrom([summarize]),
  prompt: 'Summarize this report for me: ./q3-results.pdf'
})
```

### Agent tool (LangChain)
```typescript
const agent = await createReactAgent({
  llm: new ChatOpenAI(),
  tools: arrey.toLangChain(['summarize'])
})
```

---

## Formats

| Format | Output |
|--------|--------|
| `bullets` | 5-7 bullet points. Default. |
| `tldr` | Single paragraph, under 100 words |
| `executive` | Structured: Overview, Key Points, Recommendation |
| `custom` | Whatever you define in `prompt.ts -> formats.custom` |

---

## Customization

### Change bullet style
Edit `prompt.ts` -> `formats.bullets`.
Example: change "5 to 7 bullet points" to "exactly 3 bullets" and
"start each with a strong verb" to "start each with a number."

### Add a custom format
Add a new key to `prompt.ts` -> `formats`:
```typescript
formats: {
  ...existing formats,
  internal: `
    Format as an internal Slack update.
    Use casual language. Max 3 sentences.
    Start with: "Quick update:"
  `
}
```
Use it with: `arrey summarize ./notes.txt --format internal`

### Make it domain-aware
Pass an instruction at call time - no code change needed:
```bash
arrey summarize ./legal.pdf --format bullets --instruction "Preserve all clause numbers and legal terms exactly."
```

Or hardcode it for your domain in `prompt.ts` -> `chunk`:
```typescript
chunk: `
  You are summarizing part {{index}} of {{total}} of a legal document.
  Preserve all clause numbers, party names, and dollar amounts exactly.
  ...
`
```

### Change chunking behavior
Edit `index.ts` -> the `ctx.chunk()` call:
```typescript
const chunks = await ctx.chunk(content, {
  strategy: 'sentence',  // 'semantic' | 'fixed' | 'sentence' | 'code'
  maxTokens: 1500,       // smaller chunks = more API calls but more precise
  overlap: 100,          // reduce overlap for speed, increase for coherence
})
```

### Use a different model for this tool only
Set it in `arrey.config.yaml`:
```yaml
tools:
  summarize:
    model: gpt-4o   # override the default model just for this tool
```

---

## Files

| File | Purpose | Edit frequency |
|------|---------|----------------|
| `prompt.ts` | All prompts and format definitions | Often |
| `index.ts` | Execution logic and chunking strategy | Sometimes |
| `manifest.json` | Tool metadata and I/O schema | Rarely |
| `README.md` | This file | Never (unless you want to) |

---

## How it handles long documents

1. Content is split into semantic chunks of ~2000 tokens with 200-token overlap
2. Each chunk is summarized independently (parallelized)
3. Partial summaries are combined into the final output using the format prompt
4. If there's only one chunk, the combine step is skipped entirely

This means the tool works on documents of any length - a tweet or a 500-page PDF.

---

## Composes

This tool has no dependencies on other arrey tools.
It is a primitive - other tools (like `meeting-digest`) call it internally.
