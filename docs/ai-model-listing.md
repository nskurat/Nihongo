# Fetching AI model lists from provider APIs: feasibility

Status: investigation only. No app code was changed.
Date: 2026-10-31.
Scope: replace or supplement the hardcoded `models` arrays in
`grammar-app/src/services/ai/providers/*.ts` with lists fetched from each provider.

## 1. How the app does it today

| Piece | Where | What it does |
|---|---|---|
| Provider objects | `services/ai/providers/{gemini,openai,anthropic}.ts` | Each has a static `models: AiModelOption[]` (`{id, name, isDefault?}`) and an `executePrompt` that calls `fetch` from the browser. |
| Registry | `services/ai/registry.ts` | Static `providers` map. `getStoredModel()` returns `localStorage['nihongo_ai_model_<id>']`, or the `isDefault` model if nothing is stored. A stored id is **never checked** against the list, so a retired id keeps being sent until the provider returns an error. |
| Keys | `registry.ts` | `localStorage['nihongo_ai_key_<id>']` (plus the legacy `gemini_api_key`). Keys go straight from the browser to the provider. No backend. |
| Picker | `components/common/AiSettingsModal.tsx` | A `<select>` over `provider.models`, shown only when there are 2 or more models. "Test Connection" sends a real generation prompt (`'Respond with the word "OK".'`), which uses a few billed tokens. |
| Types | `types/ai.ts` | `AiModelOption { id; name; isDefault? }`, `AiProvider.models: AiModelOption[]`. |
| Stores | `store/useAppStore.ts`, `store/useAiStore.ts` | Neither store holds anything about providers or models. Model choice lives only in raw `localStorage` through the registry. The AI cache keys do not include the model. |

Request details that matter for listing:

- **Gemini**: `POST .../v1beta/models/{model}:generateContent?key=KEY`. The key is in the query string. JSON mode uses `responseMimeType`.
- **OpenAI**: `POST /v1/chat/completions` with `temperature: 0.7` and `response_format: {type: 'json_object'}`, plus a `system` message.
- **Anthropic**: `POST /v1/messages` with `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`. The app already sends this header. `max_tokens: 8192`.

The hardcoded lists are already out of date, which is the reason to make this change:

- OpenAI still lists `gpt-3.5-turbo`, `gpt-4o` and `gpt-4o-mini`.
- Anthropic offers `claude-sonnet-5` and `claude-haiku-4-5`. Newer models in the same lines exist (`claude-sonnet-5-5`, `claude-haiku-5-5`).

## 2. Findings per provider

### Sources and how far they were verified

- **Anthropic**: I read the official reference at `https://platform.claude.com/docs/en/api/models/list` on 2026-10-31. It describes `lifecycle`, `line`, `capabilities`, `max_input_tokens` and `max_tokens`. I also sent one **unauthenticated** CORS preflight (`OPTIONS`, no key) to `api.anthropic.com/v1/models`.
- **Gemini**: `ai.google.dev` is blocked by this session's network allowlist, so I could not open the page directly. I relied on search-result extracts of `https://ai.google.dev/api/models` (2026-10-31) and on what I already knew of the `Model` resource. I sent one unauthenticated CORS preflight to `generativelanguage.googleapis.com/v1beta/models`.
- **OpenAI**: `platform.openai.com` and `api.openai.com` are both blocked here. I relied on third-party mirrors of the API reference and on what I already knew. CORS is **unverified**. Allow those hosts in the session's network settings and re-check before building anything.

No authenticated request and no generation request was made to any provider.

### Comparison table

| | Google Gemini | Anthropic | OpenAI |
|---|---|---|---|
| Endpoint | `GET https://generativelanguage.googleapis.com/v1beta/models` | `GET https://api.anthropic.com/v1/models` (and `/v1/models/{id}`) | `GET https://api.openai.com/v1/models` (and `/v1/models/{id}`) |
| Auth | `x-goog-api-key: KEY` header (preferred), or `?key=KEY` | `x-api-key: KEY` (or `Authorization: Bearer`), plus `anthropic-version`. The browser also needs `anthropic-dangerous-direct-browser-access: true`. | `Authorization: Bearer KEY`. `OpenAI-Organization` / `OpenAI-Project` are optional. |
| Pagination | `pageSize` (default 50, max 1000), `pageToken` / `nextPageToken` | `limit` (default 20, max 1000), `after_id` / `before_id`, `has_more`, `first_id` / `last_id`. Newest models come first. | None. Everything comes back in one `data` array. |
| Id and name | `name` (`models/gemini-…`, so strip the prefix), `baseModelId`, `version`, `displayName`, `description` | `id`, `display_name` | `id` only. There is no display name. |
| Release date | Not provided | `created_at` (RFC 3339; may be epoch when unknown) | `created` (Unix seconds) |
| Context and output limits | `inputTokenLimit`, `outputTokenLimit` | `max_input_tokens`, `max_tokens` | Not provided |
| Capabilities | `supportedGenerationMethods` (for example `generateContent`, `countTokens`, `embedContent`, `bidiGenerateContent`, `predict`); `thinking`; `temperature` / `maxTemperature` / `topP` / `topK` | A full `capabilities` tree with `supported` at every leaf: `structured_outputs`, `thinking.types.*`, `effort.*`, `image_input`, `pdf_input`, `batch`, `citations`, `server_tools`, `context_management` | None. You only get `owned_by` (`openai`, `system`, or your org for fine-tunes). |
| Lifecycle / deprecation | No structured field. You can only infer it from `-preview`, `-exp`, dated suffixes, or the description text. | `lifecycle` (`active` / `deprecated` / `retired`), `deprecated_at`, `retires_at`, `line` (`haiku` / `sonnet` / `opus` / `fable` / `mythos`). The query param `lifecycle=` filters, and the default returns active plus deprecated. | None |
| CORS from a GitHub Pages origin | **Yes.** The preflight returned `access-control-allow-origin: https://nskurat.github.io` with `x-goog-api-key` allowed. Do **not** send an `Authorization` header: the preflight that included it got a 403. | **Yes.** The preflight returned `access-control-allow-origin: *`, with `x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access` allowed. The header is required, otherwise the API returns a 401 asking for it. | **Unverified.** Some 2026 third-party write-ups say `api.openai.com` sends no CORS headers to browsers. If that is true, the app's **existing** OpenAI provider is already broken in the browser, regardless of model listing. This is a critical open question. |
| Cost | No tokens. Rate-limited per project. | No tokens. Standard rate limits apply. | No tokens. Standard rate limits apply. |
| Noise (non-text models in the raw list) | High: embeddings, `aqa`, Imagen, Veo, TTS, live/native-audio, image-generation, Gemma, `-latest` aliases, preview or experimental dated variants | Low: only Claude text models. Deprecated models are included by default. | Very high: embeddings, `whisper-*`, `tts-*`, `dall-e-*`, `gpt-image-*`, `omni-moderation-*`, `*-realtime-*`, `*-audio-*`, `*-transcribe`, `*-search-*`, legacy completions (`davinci-002`, `babbage-002`), dated snapshots, `ft:` fine-tunes, Responses-API-only models (`*-pro`, `*codex*`, deep-research) |
| How reliable filtering is | **Good**: keep only models whose `supportedGenerationMethods` includes `generateContent`, then exclude by name patterns (embedding, tts, image, live, audio, aqa, gemma) | **Excellent**: `lifecycle === 'active'`, plus `capabilities.structured_outputs.supported` if wanted | **Poor**: name heuristics only. A listed model can still reject the app's request (see section 4). |
| Verdict | **Feasible** | **Feasible, best fit** | **Feasible only with an allowlist; CORS must be confirmed first** |

## 3. Filtering, ordering and defaults (all pure functions)

All of these take the raw JSON and return `AiModelOption[]`. No `fetch` happens inside them, so they are trivial to unit-test with fixture JSON.

- **Anthropic**
  - Filter: `lifecycle === 'active'`, and `max_tokens >= 8192`, because the app sends `max_tokens: 8192`.
  - Order: the API already returns newest first. Optionally group by `line`.
  - Name: use `display_name`.
  - Default: the newest active `sonnet` (balanced cost for learners). Fall back to the newest active model.
  - If a deprecated model is stored, show it with a "retiring <date>" badge.
- **Gemini**
  - Strip the `models/` prefix.
  - Keep a model if `supportedGenerationMethods` includes `generateContent`.
  - Drop names matching `/embed|aqa|imagen|veo|tts|image|live|native-audio|gemma|learnlm|robotics|computer-use/`.
  - Hide `-exp` and dated preview variants (`-preview-MM-DD`) behind a "show previews" toggle.
  - Keep the floating aliases (`gemini-flash-latest`, `gemini-pro-latest`) and pin them to the top: they never go stale.
  - Order: sort by parsed version number descending, flash before pro, which puts the cheap models first.
  - Default: the newest stable `*-flash`.
- **OpenAI**
  - Use an **allowlist regex**, not a denylist: `^(gpt-\d[\w.]*|o\d[\w-]*)` together with `owned_by in {openai, system}`.
  - Then deny `/realtime|audio|transcribe|tts|search|image|pro|codex|deep-research|instruct|embedding|moderation/`.
  - Hide dated snapshots (`-\d{4}-\d{2}-\d{2}$`) whenever their undated alias is present.
  - Order: by `created` descending.
  - Name: generate from the id (`gpt-5-mini` becomes "GPT-5 mini"), because the API provides no name.
  - Default: the newest `*-mini`.
- **For every provider**: merge the fetched list with the curated list. Curated entries keep their friendly names and `isDefault`. Curated entries that are missing from the fetched list are marked "unavailable for your key" instead of being removed silently. A stored model that is not in the merged list stays selectable with a warning.

## 4. Risks

1. **A listed model may not accept the app's request.**
   - OpenAI reasoning models (the o-series and GPT-5 class) reject a `temperature` other than the default, and some reject `system` or `response_format`. `*-pro` and `*codex*` are Responses-API-only, so `/v1/chat/completions` returns 404.
   - Mitigation: the allowlist above. Also, before listing becomes trustworthy, `openai.ts` has to stop sending `temperature` to reasoning models; that is a separate fix.
   - Gemini thinking models work with `generateContent`. Image-output models also report `generateContent`, which is why the name filter is needed.
   - Anthropic is low risk. Note that the app's pinned `anthropic-version: 2023-06-01` may or may not return the newer fields (`lifecycle`, `capabilities`). This is unverified; if needed, send a newer version on the list call only.
2. **No key, no list.** First-time users have no key, so the shipped curated list must always render. Fetching only adds to it.
3. **Latency.** A list call is about 100–400 ms, and Anthropic and Gemini return one page at `limit=1000`. Never block the modal on it. Show the cached or curated list immediately and refresh in the background, or only on demand.
4. **Rate limits / 401 / 403.** Treat any failure as "keep the curated list" and show a quiet inline note. Never throw into the modal.
5. **Caching.** Store `nihongo_ai_models_<provider>` as `{fetchedAt, keyHash, models}` with a TTL of about 7 days. Invalidate when the key changes. Use a short non-reversible fingerprint, never the key itself.
6. **Offline.** Fall back to the cache, then to the curated list. Generation fails offline anyway.
7. **Key exposure.** No new exposure: the list call goes to the same host with the same key as generation.
   - Gemini already puts the key in the URL query, where it can end up in browser history or extensions. The list call should use the `x-goog-api-key` header, and the generate call should switch to it too.
8. **Unverified OpenAI CORS.** See section 2. If browsers really are blocked, neither listing nor generation can work without a proxy, and AGENTS.md rules out a proxy unless the owner asks for one.

## 5. Recommended design

```
services/ai/
  models/
    curated.ts            Shipped fallback lists (move the `models` arrays here; keep
                          friendly names and isDefault)
    filters.ts            PURE: filterGeminiModels(raw), filterAnthropicModels(raw),
                          filterOpenAiModels(raw), mergeWithCurated(fetched, curated),
                          pickDefault(list), prettifyOpenAiId(id)
    modelCatalog.ts       Adapter in the style of readingStorage.ts:
                          abstract BaseModelCatalog { list(provider): Promise<ModelListResult> }
                          LocalStorageCachedCatalog(storage: StorageLike, fetcher, now)
    __tests__/filters.test.ts      fixture JSON per provider -> expected options
    __tests__/modelCatalog.test.ts TTL, key-change invalidation, fallback on error
  providers/*.ts          add optional `listModels(apiKey): Promise<unknown>` (raw JSON,
                          fetch only - no logic). Gemini uses x-goog-api-key; Anthropic
                          sends the direct-browser header and limit=1000.
```

- Extend `AiModelOption` with optional fields: `source: 'curated' | 'api'`, `contextWindow?`, `maxOutput?`, `lifecycle?: 'active' | 'deprecated'`, `retiresAt?`, `preview?: boolean`.
- `ModelListResult = { models; source: 'curated' | 'cache' | 'live'; fetchedAt?; error? }`.
- In tests, mock the fetcher that is injected into the catalog. Never hit the network.
- Listing does **not** pass through `executeAiPrompt`. It is a separate boundary that also never costs tokens, but it still must not run in tests or scripts.
- When to fetch: only (a) when the user clicks "Refresh models", or (b) automatically once after a key is saved, if the cache is missing or older than the TTL. Never fetch on page load.
- Bonus: a successful list call is a **free key check**. "Test Connection" could call it instead of a generation prompt, which spends tokens today. A short generation test would still be worth keeping, to catch model-specific problems.

## 6. UX implications for the model picker

- Always render the picker, even when there is one model, because the list can now grow.
- Show a small source line: "Recommended models" (curated), "From your account · updated 3 days ago" (cache or live), and a ↻ **Refresh** button that is disabled when no key is set.
- Group the options with `<optgroup>`: Recommended (curated and defaults), Latest, Previews (collapsed or toggled), Deprecated (Anthropic, with a "retires …" badge).
- Show context or output limits as secondary text where the API provides them (Anthropic, Gemini).
- If the stored model is missing from the fetched list, show a warning ("not available for this key – pick another") and do not change it silently.
- On error, show an inline muted message and keep the current list. Never block saving.
- A native `<select>` gets unwieldy past about 30 options. Filtering keeps the list around 5–15 per provider, so a searchable combobox is not needed.

## 7. Effort estimate

| Task | Estimate |
|---|---|
| `filters.ts` with fixtures and tests for 3 providers | 0.5–1 day |
| `modelCatalog.ts` adapter, cache/TTL, tests | 0.5 day |
| `listModels` in the 3 providers, type extension, registry wiring (`getStoredModel` default from catalog) | 0.25 day |
| Modal UX (refresh, groups, badges, warnings) | 0.5 day |
| Verify OpenAI CORS; fix `temperature` / reasoning-model params in `openai.ts` | 0.25–0.5 day |
| **Total** | **about 2–3 dev-days.** Anthropic plus Gemini alone is about 1.5 days. |

## 8. Open questions

1. **OpenAI CORS**: does `api.openai.com` currently answer browser preflights from `nskurat.github.io`? Check from DevTools with an `OPTIONS` request, which needs no key. If the answer is no, the existing OpenAI provider is already broken. This blocks the OpenAI part of the plan.
2. Does Anthropic return `lifecycle`, `line` and `capabilities` with `anthropic-version: 2023-06-01`, or is a newer version header needed on the list call?
3. Should preview or experimental Gemini models be selectable at all for learners? Previews are often free-tier-friendly but get pulled with little notice.
4. Should fine-tuned OpenAI models (`ft:…`) be offered to power users? The recommendation is no.
5. Cache TTL: 7 days, or refresh-on-demand only?
6. Should "Test Connection" switch to the free list call (key check only), or run both?
7. The AI content cache keys ignore the model. Is that acceptable once users can pick from many more models?
