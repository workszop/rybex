# rybex-ai – class proxy for real model calls

The workshop app (`rybex-ai-workshop.html`) calls small models through this Cloudflare Worker.
The OpenRouter key and the class code live here as Worker secrets; the page never sees the key.

- Models allowed: `deepseek/deepseek-v4.1-flash` (default in the app) and `anthropic/claude-haiku-5.5`.
- Every request: class code checked, reasoning switched off, `max_tokens` capped at 700, at most 10 images.
- Embeddings for the knowledge assistant: `POST /embed` with one model (`EMBED_MODELS`, default `openai/text-embedding-3-small`) and one fixed vector size (`EMBED_DIMENSIONS`, default 256). Same class code, team, budgets and cache as `/chat`; see "Endpoints" below.
- Daily budget per team (`TEAM_DAILY_USD`, default 1.00) and for the whole class (`TOTAL_DAILY_USD`, default 15.00).
- Teams 1–`TEAM_COUNT` only (default 8; other `X-Team` values get 400 `bad_team`). Keep `TEAM_COUNT × TEAM_DAILY_USD` below `TOTAL_DAILY_USD`, so one code holder cannot use up the class budget by switching team numbers.
- Each call sets aside `RESERVE_USD` (default 0.01) before it goes to OpenRouter and settles to the real cost afterwards (or back to 0 when the call fails), so parallel calls cannot all slip under the limit.
- Identical requests are answered from a cache in the Durable Object (7 days), so 8 teams running the same test set pay once.
- Spend and cache live in one SQLite Durable Object (`Gate`). The Cache API is not used because it does nothing on `*.workers.dev`.

## Endpoints

All take `X-Class-Code` and `X-Team` (1 to `TEAM_COUNT`) headers; CORS allows `ALLOWED_ORIGINS`, localhost and `file://` pages.

| Endpoint | Request | Response |
|---|---|---|
| `POST /chat` | OpenAI-style `{model, messages, max_tokens, response_format?, temperature?, seed?}` | OpenRouter's chat completion plus `rybex: {cached, teamSpend, totalSpend, limits}` |
| `POST /embed` | `{model, input: string or string[] (1 to 32 texts, each up to 8000 characters), dimensions?}`; `dimensions` may be left out and otherwise must equal `EMBED_DIMENSIONS` | `{object: "list", model, data: [{index, embedding: number[256]}], usage: {prompt_tokens, total_tokens, cost}, rybex: {cached, teamSpend, totalSpend, limits, dim}}`; one vector per text, in input order, numbers rounded to 5 decimals |
| `GET /status` | none | `{ok, teamSpend, teamCalls, totalSpend, limits, models, embed: {models, dimensions}}` |

`/embed` errors: 401 `bad_code`, 400 `bad_team` / `bad_request` (not JSON, empty or non-text input) / `model_not_allowed` / `bad_dimensions` / `too_large` (more than 32 texts, a text over 8000 characters, body over 400 kB), 429 `budget_team` / `budget_total`, 502 `upstream` (OpenRouter failed or returned a wrong number or size of vectors; not charged, not cached), 500 `not_configured`.

The Worker calls OpenRouter's embeddings API (`POST https://openrouter.ai/api/v1/embeddings`, body `{model, input, dimensions, encoding_format: "float"}`; reference: <https://openrouter.ai/docs/api-reference/embeddings/create-embeddings>, model list: <https://openrouter.ai/api/v1/embeddings/models>). The call's cost is taken from `usage.cost`; when OpenRouter leaves it out, it is `prompt_tokens × EMBED_USD_PER_MTOK / 1 000 000`. Each call sets aside `EMBED_RESERVE_USD` (default 0.001) while it runs. An identical request (same model, texts and size) is answered from the 7-day cache at no cost, so teams that build the knowledge base on the same settings pay once: the app always sends the same batches of 16 fragments for the same settings.

The app expects exactly `openai/text-embedding-3-small` with 256 numbers (`AI_EMBED` in `js/ai-client.js`). Changing the model or the size here means changing it there too, and every knowledge base has to be built again.

## Deploy (once)

```bash
cd worker
npx wrangler deploy
npx wrangler secret put OPENROUTER_API_KEY   # paste the key when prompted
npx wrangler secret put CLASS_CODE           # e.g. rybex-2026; several codes: code1,code2
```

Updating a Worker that is already deployed (for example to add `/embed`) is only `cd worker && npx wrangler deploy`: the secrets stay, the new `EMBED_*` values come from `wrangler.toml`, and the Durable Object needs no new migration. Check that the OpenRouter key may use `openai/text-embedding-3-small` (no provider restriction on the key that excludes OpenAI). Then:

```bash
curl -s https://rybex-ai.andrzey-jankowski.workers.dev/embed -H "X-Class-Code: <code>" -H "X-Team: 8" -H "Content-Type: application/json" \
  -d '{"model":"openai/text-embedding-3-small","input":["Co ile minut kontroluje się szew puszki?"],"dimensions":256}' | head -c 300
```

The answer must start with `{"object":"list"` and carry 256 numbers. A Worker without the endpoint answers 404 and the app then says that the class server needs an update.

The app expects the Worker at `https://rybex-ai.andrzey-jankowski.workers.dev`. If the URL differs, change `AI_DEFAULT_URL` in the HTML, or open the app with `?ai=<worker url>`.

Check it:

```bash
curl -s https://rybex-ai.andrzey-jankowski.workers.dev/status -H "X-Class-Code: <code>" -H "X-Team: 1"
```

## On the day

- Give students the class code. They type it in the "Language model via API" card in the Build lab (Vision, Knowledge assistant, Complaints). The card appears once the lab uses the model: "Vision model" in Vision, "Language model" in Knowledge assistant, "Language model with a prompt" in Complaints.
- Change or revoke the code: `npx wrangler secret put CLASS_CODE` (takes effect immediately).
- Raise or lower the budget: edit `TEAM_DAILY_USD` / `TOTAL_DAILY_USD` in `wrangler.toml` and `npx wrangler deploy`, or edit the variables in the Cloudflare dashboard.
- Spend so far: `GET /status` with the code (per team via `X-Team`), or OpenRouter's activity page.

## Backup without the Worker (replay.json)

1. Before class, open the app in trainer mode (`?trainer=1`) and run the labs once with the model (all tracks you want to show).
2. In the "Language model via API" card click "For the facilitator: download this session's answers as replay.json" (shown only in trainer mode).
3. Put `replay.json` next to `rybex-ai-workshop.html` in the GitHub Pages repo.

If the Worker is unreachable, the app answers recorded requests from that file at no cost. Requests that were not recorded end with the "no connection" message. The knowledge assistant's recording also holds the embedding requests of the default knowledge base; record it only after this Worker has `/embed`.

## Tests

```bash
cd tests && npm install          # Playwright, once
node worker.mjs                  # Worker contract against a mock OpenRouter (wrangler dev)
node ai.mjs                      # app probes against a mock Worker (no real calls, no cost)
node mock-server.mjs 8794        # then open http://127.0.0.1:8794/rybex-ai-workshop.html?ai=http://127.0.0.1:8794/mock
```

Class code for the mock: `test-code` (`broke` simulates an exhausted budget).
