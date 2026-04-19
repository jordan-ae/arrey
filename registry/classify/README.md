# arrey/tools/classify

Classifies text, files, or URLs into a fixed set of labels.
Returns a ranked list with per-label confidence and a one-line reasoning.
Single-label by default, multi-label on demand.
This code is yours - edit it freely.

---

## Usage

### CLI
```bash
arrey classify "charge me twice, need refund" --labels billing,shipping,account
arrey classify ./ticket.txt --labels bug,feature,question
arrey classify ./article.md --labels security,performance,dx --multi-label
```

### SDK
```typescript
import { arrey } from 'arrey'

const result = await arrey.run('classify', {
  content: './ticket.txt',
  labels: ['billing', 'shipping', 'account', 'technical']
})

console.log(result.topLabel)       // 'billing'
console.log(result.results[0])     // { label, confidence, reasoning }
```

### Direct import
```typescript
import { classify } from './arrey/tools/classify'

const result = await classify({
  prompt: './ticket.txt',
  labels: ['billing', 'shipping', 'account'],
  labelDescriptions: {
    billing: 'payments, charges, refunds, invoices',
    shipping: 'delivery, tracking, lost packages',
    account: 'login, password, profile settings'
  }
})
```

---

## Why label descriptions matter

Models classify better when labels are unambiguous.
Descriptions are injected into the prompt alongside the label name,
so `billing: "payments, charges, refunds, invoices"` produces a sharper decision
than a bare `billing` token.

---

## Single-label vs multi-label

| Mode | When to use |
|------|-------------|
| single-label (default) | You need exactly one category — routing, triage, bucket-and-forget |
| multi-label | Content can belong to multiple categories — topic tags, content moderation |

Multi-label returns an empty array when nothing clearly applies. Downstream code
should treat an empty `results` array as "unclassifiable."

---

## Customization

### Change the decision rules
Edit `prompt.ts` -> `singleLabel` or `multiLabel`. Add domain-specific rules
at the top of the prompt, e.g. "If the content mentions a card charge, always
prefer billing over account."

### Stricter parsing
The tool expects JSON back. If your provider is chatty, set `temperature: 0`
(already the default inside `run()`) and consider adding a `stopSequences`
option in `toRunOptions`.

---

## Files

| File | Purpose | Edit frequency |
|------|---------|----------------|
| `prompt.ts` | Classifier prompts | Often |
| `index.ts` | Parsing and execution | Sometimes |
| `manifest.json` | Tool metadata and I/O schema | Rarely |
| `README.md` | This file | Never |

---

## Composes

This tool has no dependencies on other arrey tools.
It is a primitive — other tools can call it internally to route work.
