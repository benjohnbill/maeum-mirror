# Deploy decisions (Lane D)

Status: settled 2026-11-22 (user via hub). Deploy not run yet.

## Settled
- Host: Vercel Hobby, deployed with the Vercel CLI from the local tree (no Next.js,
  no Supabase, no `release` branch). `vercel login` and every production deploy need
  the user's OK at that moment.
- Shape: `public/` is served as static files (`vercel.json` `outputDirectory`);
  `api/chat.js` and `api/status.js` wrap `lib/chat.mjs`. The local `server.mjs` uses
  the same `lib/chat.mjs`. `.vercelignore` keeps `.env`, `research/`, `testbed/`,
  `docs/`, `scripts/` out of the upload.
- Keys: all three free keys (`GEMINI_API_KEY`, `_1`, `_2`), with the existing rotation.
  One key alone breaks the fallback (2.5 models return 404 on some keys). The paid key
  is an option for later, not used now. Keys go in Vercel env vars only.
- Timeout: `GEMINI_TIMEOUT_MS=45000` (code default). 20 s made 3.5-flash (22–32 s)
  fall back, and lane C saw flash-lite misread the data. Fallback chain unchanged.
  Lanes A and C measure with the same values; a change at the 14:00 smoke goes to lane C.
- Lane A found: `gemini-3.5-flash` answers with `modelVersion: gemini-3.6-flash`.

## Verification
- `gemini()` in `lib/chat.mjs` is byte-identical to the old `server.mjs` body.
- Local smoke 2026-11-22: `/api/status`, bad JSON → 502, bad summary → 502, `/` → 200,
  one real opener turn → 200 from `gemini-3.5-flash`.
- Pending: lane A replay before/after the extraction (hub informed lane A).

## 14:00 release smoke (draft)
1. Open the deployed URL in a fresh browser; load the synthetic user.
2. Run a full conversation to the report; record per-turn latency.
3. Check `modelVersion` in a response.
4. Run the crisis path once.
