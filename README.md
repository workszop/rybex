# AI Project Lab – Rybex

Workshop app for running an AI project end to end for Rybex, a fictional canned-fish manufacturer: task choice, data, method, prototype, evaluation and report. Polish and English.

**Open:** https://workszop.github.io/rybex/

- One self-contained HTML file (`rybex-ai-workshop.html`), no build step. Team work is stored in the browser and can be exported as a team file.
- Rybex data: 210 photo-style can images (`assets/vision-realistic/web/`, 320×400 JPEG, about 5 MB; drawn images are the fallback when they cannot load), plus synthetic sales history, sensor readings, complaints and process documents (PROCES-01…05).
- The vision pixel rules measure the photos (dent, label shift, batch-code sharpness). The set includes borderline cases (shallow dents, small label shifts, light smudges, harmless glare, soft print) so the thresholds involve a real trade-off.
- Build lab with five tracks (vision, knowledge assistant, complaints, demand forecast, machine failures), each with a rule or statistics baseline and a train / test discipline.
- Real model calls in the vision, knowledge-assistant and complaints labs (DeepSeek V4.1 Flash or Claude Haiku 5.5 via OpenRouter): prompt versions, few-shot examples, a learning curve, an LLM judge and a model comparison, with tokens, cost and time for every call. No model is trained.

The app also runs opened straight from disk (`file://`). There the photos come from `assets/vision-realistic/web/photos.js`, a generated bundle of the same JPEGs. Rebuild it whenever the JPEGs or their `manifest.json` change (`node tests/ai.mjs file` fails while it is out of date):

```bash
node tools/vision-bundle.mjs
```

Model calls go through the Cloudflare Worker in `worker/`, which holds the API key and checks a class code; see [worker/README.md](worker/README.md). Without the Worker the labs run on their rule-based baselines.

## Tests

```bash
cd tests && npm install
node ai.mjs        # app probes against a mock Worker (no real calls)
node vision-realistic.mjs  # photo asset loading and fallback
node worker.mjs    # Worker contract against a mock OpenRouter
```
