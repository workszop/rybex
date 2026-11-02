# AI Project Lab – Rybex

Workshop app for running an AI project end to end for Rybex, a fictional canned-fish manufacturer: task choice, data, method, prototype, evaluation and report. Polish and English.

**Open:** https://workszop.github.io/rybex/

- One self-contained HTML file (`rybex-ai-workshop.html`), no build step. Team work is stored in the browser and can be exported as a team file.
- Synthetic Rybex data: can images, sales history, sensor readings, complaints and SOP documents.
- Build lab with five tracks (vision, knowledge assistant, complaints, demand forecast, machine failures), each with a rule or statistics baseline and a train / test discipline.
- Real model calls in the vision, knowledge-assistant and complaints labs (DeepSeek V4.1 Flash or Claude Haiku 5.5 via OpenRouter): prompt versions, few-shot examples, a learning curve, an LLM judge and a model comparison, with tokens, cost and time for every call. No model is trained.

Model calls go through the Cloudflare Worker in `worker/`, which holds the API key and checks a class code; see [worker/README.md](worker/README.md). Without the Worker the labs run on their rule-based baselines.

## Tests

```bash
cd tests && npm install
node ai.mjs        # app probes against a mock Worker (no real calls)
node worker.mjs    # Worker contract against a mock OpenRouter
```
