# arrey/tools/translate

Translates text, files, and URLs into a target language.
Preserves document structure, skips code and URLs, supports tone and glossary.
Handles long documents through paragraph-level chunking.
This code is yours - edit it freely.

---

## Usage

### CLI
```bash
arrey translate ./docs/intro.md --to Spanish
arrey translate "Hello world" --to French --tone casual
arrey translate https://example.com/article --to Japanese --tone formal
```

### SDK
```typescript
import { arrey } from 'arrey'

const result = await arrey.run('translate', {
  content: './docs/intro.md',
  targetLang: 'Spanish',
  tone: 'neutral'
})

console.log(result.translation)
```

### Direct import
```typescript
import { translate } from './arrey/tools/translate'

const result = await translate({
  prompt: './contract.md',
  targetLang: 'German',
  tone: 'formal',
  glossary: {
    'arrey': 'arrey',
    'customer': 'Kunde'
  }
})
```

---

## Tones

| Tone | Use for |
|------|---------|
| `neutral` | Default. Accurate, plain. |
| `formal` | Business, legal, official docs. Uses formal pronouns where applicable. |
| `casual` | Marketing copy, chat messages, UI strings. |
| `literal` | Technical docs where word-for-word fidelity matters. |

---

## Glossary

Pass a map of terms that must be translated a specific way.
Useful for brand names, product names, and regulated terminology.

```typescript
await translate({
  prompt: './legal/terms.md',
  targetLang: 'French',
  glossary: {
    'arrey': 'arrey',              // keep brand name as-is
    'subscriber': 'abonné',        // force specific translation
    'Data Processor': 'Sous-traitant'
  }
})
```

Terms not in the glossary are translated normally.

---

## What it preserves

- Markdown headings, lists, tables, blockquotes
- Code blocks (contents untranslated)
- Variable names, file paths, URLs
- Inline code spans
- Line breaks and paragraph structure

---

## Customization

### Add a new tone
Add a new key to `prompt.ts -> tones`:
```typescript
tones: {
  ...existing,
  academic: `
    Use formal academic register. Prefer passive voice where natural.
    Cite original terminology in parentheses on first occurrence.
  `
}
```
Use with `{ tone: 'academic' as any }` — or widen the `TranslateInput.tone` union in `index.ts`.

### Change chunking behavior
For very long books, reduce `maxTokens` in `index.ts -> ctx.chunk()` to
translate smaller slices and fit into stricter output limits.

---

## Files

| File | Purpose | Edit frequency |
|------|---------|----------------|
| `prompt.ts` | Translation rules and tones | Often |
| `index.ts` | Chunking and execution | Sometimes |
| `manifest.json` | Tool metadata | Rarely |
| `README.md` | This file | Never |

---

## Composes

This tool has no dependencies on other arrey tools.
