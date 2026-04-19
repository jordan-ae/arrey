# arrey/tools/transcribe (experimental)

Transcribes audio from URLs into text.
Supports optional cleanup and instruction-guided post-processing.
This code is yours - edit it freely.

---

## Usage

### CLI
```bash
arrey transcribe https://example.com/meeting.wav
arrey transcribe https://example.com/meeting.wav --language en
arrey transcribe https://example.com/interview.mp3 --instruction "Preserve product names exactly"
```

### SDK
```typescript
import { arrey } from 'arrey'

const result = await arrey.run('transcribe', {
  audioUrl: 'https://example.com/meeting.wav',
  language: 'en'
})

console.log(result.transcript)
```

### Direct import (tool-local helper)
```typescript
import { transcribe } from './arrey/tools/transcribe'

const result = await transcribe({
  audioUrl: 'https://example.com/meeting.wav',
  language: 'en',
  temp: 0.1,
  model: 'gpt-4o-mini-transcribe'
})

console.log(result.transcript)
```

### Agent tool (Vercel AI SDK)
```typescript
import { arrey } from 'arrey'
import { transcribe } from './arrey/tools/transcribe'

const tools = await arrey.toVercelAIFrom([transcribe])
```

---

## Notes

- This tool is marked experimental in `manifest.json`.
- It is excluded from adapter auto-discovery unless explicitly requested.
- It expects `provider.apiKey` and optional `provider.endpoint` in config.

---

## Customization

### Change transcription style
Edit `prompt.ts` -> `system`.

### Change cleanup behavior
Edit `prompt.ts` -> `cleanup`.

### Disable cleanup pass
Pass `clean: false` in input.

### Use a tool-specific model
Set in `arrey.config.yaml`:
```yaml
tools:
  transcribe:
    provider:
      model: gpt-4o-mini-transcribe
```

---

## Files

| File | Purpose | Edit frequency |
|------|---------|----------------|
| `prompt.ts` | Provider prompt and cleanup prompt | Often |
| `index.ts` | API call and post-processing flow | Sometimes |
| `manifest.json` | Metadata and I/O schema | Rarely |
| `README.md` | This file | Optional |
