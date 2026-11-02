# rybex-ai – class proxy for real model calls

The workshop app (`rybex-ai-workshop.html`) calls small models through this Cloudflare Worker.
The OpenRouter key and the class code live here as Worker secrets; the page never sees the key.

- Models allowed: `deepseek/deepseek-v4.1-flash` (default in the app) and `anthropic/claude-haiku-5.5`.
- Every request: class code checked, reasoning switched off, `max_tokens` capped at 700, at most 10 images.
- Daily budget per team (`TEAM_DAILY_USD`, default 1.00) and for the whole class (`TOTAL_DAILY_USD`, default 15.00).
- Identical requests are answered from a cache in the Durable Object (7 days), so 8 teams running the same test set pay once.
- Spend and cache live in one SQLite Durable Object (`Gate`). The Cache API is not used because it does nothing on `*.workers.dev`.

## Deploy (once)

```bash
cd worker
npx wrangler deploy
npx wrangler secret put OPENROUTER_API_KEY   # paste the key when prompted
npx wrangler secret put CLASS_CODE           # e.g. rybex-2026; several codes: code1,code2
```

The app expects the Worker at `https://rybex-ai.andrzey-jankowski.workers.dev`. If the URL differs, change `AI_DEFAULT_URL` in the HTML, or open the app with `?ai=<worker url>`.

Check it:

```bash
curl -s https://rybex-ai.andrzey-jankowski.workers.dev/status -H "X-Class-Code: <code>" -H "X-Team: 1"
```

## On the day

- Give students the class code. They type it in the "Language model via API" card in the Build lab (Vision, Knowledge assistant, Complaints).
- Change or revoke the code: `npx wrangler secret put CLASS_CODE` (takes effect immediately).
- Raise or lower the budget: edit `TEAM_DAILY_USD` / `TOTAL_DAILY_USD` in `wrangler.toml` and `npx wrangler deploy`, or edit the variables in the Cloudflare dashboard.
- Spend so far: `GET /status` with the code (per team via `X-Team`), or OpenRouter's activity page.

## Backup without the Worker (replay.json)

1. Before class, run the labs once with the model (all tracks you want to show).
2. In the "Language model via API" card click "For the facilitator: download this session's answers as replay.json".
3. Put `replay.json` next to `rybex-ai-workshop.html` in the GitHub Pages repo.

If the Worker is unreachable, the app answers recorded requests from that file at no cost. Requests that were not recorded fall back to the rule-based baselines with a message.

## Tests

```bash
cd tests && npm install          # Playwright, once
node worker.mjs                  # Worker contract against a mock OpenRouter (wrangler dev)
node ai.mjs                      # app probes against a mock Worker (no real calls, no cost)
node mock-server.mjs 8794        # then open http://127.0.0.1:8794/rybex-ai-workshop.html?ai=http://127.0.0.1:8794/mock
```

Class code for the mock: `test-code` (`broke` simulates an exhausted budget).
