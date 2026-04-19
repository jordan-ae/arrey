# arrey/tools/extract

Extracts key facts from text, files, and URLs into configurable formats.
Handles long documents automatically via chunk extraction and merge.
This code is yours - edit it freely.

---

## Usage

### CLI
```bash
arrey extract ./notes.md
arrey extract ./notes.md --format json
arrey extract https://example.com/brief --format table
arrey extract "paste text here" --format bullets --maxItems 5
```

### SDK
```typescript
import { arrey } from 'arrey'

const result = await arrey.run('extract', {
  content: './research.md',
  format: 'json'
})

console.log(result.extraction)
```

### Direct import (tool-local helper)
```typescript
import { extract } from './arrey/tools/extract'

const result = await extract({
  prompt: './research.md',
  format: 'json',
  temp: 0.2,
  model: 'gpt-4.1-mini'
})

console.log(result.extraction)
```

### Agent tool (Vercel AI SDK)
```typescript
import { arrey } from 'arrey'
import { extract } from './arrey/tools/extract'

const tools = await arrey.toVercelAIFrom([extract])
```

---

## Formats

| Format | Output |
|--------|--------|
| `bullets` | 5-10 concise factual bullets |
| `json` | JSON array of facts with confidence labels |
| `table` | Markdown table (`Fact | Evidence`) |
| `custom` | Whatever you define in `prompt.ts -> formats.custom` |

---

## Customization

### Tune extraction behavior
Edit `prompt.ts` -> `chunk` and `combine`.

### Change output style
Edit `prompt.ts` -> `formats`.

### Reduce output length
Pass `maxItems` at runtime:
```bash
arrey extract ./contract.md --format bullets --maxItems 3
```

### Tool-specific model override
Set in `arrey.config.yaml`:
```yaml
tools:
  extract:
    provider:
      model: gpt-4o
```

---

## Files

| File | Purpose | Edit frequency |
|------|---------|----------------|
| `prompt.ts` | Prompts and output formats | Often |
| `index.ts` | Execution, chunking, merge behavior | Sometimes |
| `manifest.json` | Metadata and I/O schema | Rarely |
| `README.md` | This file | Optional |
