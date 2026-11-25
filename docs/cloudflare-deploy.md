# Cloudflare Deploy — aquira-valentine-week

Deploy readiness for the Valentine Week app, set up to match Wishora
(`bshubham13/birthday-experience`) as-is. Written 25 Nov 2026, on branch
`feature/cloudflare-deploy` (from main `b275dcc`).

## Verdict

**Deploy-ready as-is, like Wishora** — the repo-side configuration is already
the same shape as `birthday-experience`. Two steps can only be done on the
user's Cloudflare account (see §4); nothing else is missing in the repo.

## 1. Eligibility checklist

### Present (verified in this repo)

| Requirement | Status | Evidence |
|---|---|---|
| `wrangler.json` with Worker name, entry point, assets | ✅ | `name: "aquira-valentine-week"`, `main: "src/worker/index.ts"`, `compatibility_date: "2024-11-01"`, `assets: { directory: "./dist", not_found_handling: "single-page-application" }` — identical in shape to Wishora's `wrangler.json` (name `wishora`, same `main`, same assets block, same compatibility date) |
| Build produces `dist/` | ✅ | `npm run build` = `tsc -b && vite build`; verified locally — see §5 |
| Worker serves the app + photo API | ✅ | `src/worker/index.ts` falls back to `env.ASSETS` for all app routes and handles `/api/photos/*` |
| Photo storage ported from Wishora | ✅ | Same Worker + KV pattern, only the binding name differs (`WISHORA_PHOTOS` → `VALENTINE_PHOTOS`) |
| No Cloudflare workflow file needed | ✅ | Wishora has no Cloudflare workflow either — its only workflow is `.github/workflows/deploy-pages.yml` (GitHub Pages, not Cloudflare). Cloudflare auto-deploy is dashboard-side git integration, so there is nothing to copy into this repo for it |

### Missing — user-side only (cannot be done from the repo)

| Requirement | Status | Why it stays open |
|---|---|---|
| Real `VALENTINE_PHOTOS` KV namespace IDs in `wrangler.json` | ⏳ placeholder IDs (`00000000000000000000000000000000`) | Creating a KV namespace needs the user's Cloudflare login. The user deferred this ("leave KV aside, complete the rest"). See §3 for the commands |
| Repo connected in the Cloudflare dashboard | ⏳ not connected | Git integration is configured in the Cloudflare dashboard, not in the repo. See §2 |

## 2. How auto-deploy works (same as Wishora)

Wishora (`wishora.aquicraft.workers.dev`) deploys automatically: every push to
`main` triggers a Cloudflare build + deploy. Nothing in that repo triggers it
— the connection lives in the Cloudflare dashboard. Same setup for this repo:

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Connect to Git**.
2. Select repository **`bshubham13/aquira-valentine-week`**.
3. Build command: **`npm run build`**. (`wrangler.json` in the repo is picked
   up automatically — Worker name, entry point, assets directory and KV
   binding all come from it. No extra dashboard settings needed.)
4. Every push to **`main`** then redeploys automatically, and the site updates
   at `https://aquira-valentine-week.<account>.workers.dev/` (the exact
   subdomain is shown in the dashboard after the first deploy).

## 3. KV namespace creation (user only — needs Cloudflare login)

```bash
npx wrangler kv namespace create VALENTINE_PHOTOS
npx wrangler kv namespace create VALENTINE_PHOTOS --preview
```

Paste the returned IDs into `wrangler.json` under `kv_namespaces`
(`id` and `preview_id`), commit, and push. No code change is needed —
photos start working as soon as the real IDs are in place.

### Placeholder verdict (checked 25 Nov 2026)

`wrangler deploy --dry-run` (wrangler 4.168.0) **passes with the all-zero
placeholder IDs**: it reads the 6 files from `dist/`, lists the binding as
`env.VALENTINE_PHOTOS (00000000000000000000000000000000) KV Namespace`, and
exits cleanly. So the placeholder block does **not** block a deploy at the
config-validation stage, and `wrangler.json` was left unchanged.

Caveat, stated honestly: `--dry-run` is local config validation only — it
does not call the Cloudflare API, so it does not prove the real deploy will
accept a namespace ID that does not exist in the account. If the first real
deploy rejects the placeholder ID, the documented fallback is to delete the
`kv_namespaces` block from `wrangler.json` and redeploy: the Worker already
handles a missing binding gracefully (see §4), the site keeps working, and
re-adding the real IDs later re-enables photos with no code change.

## 4. What works without KV

The Worker treats `VALENTINE_PHOTOS` as optional (`Env` declares it as
`VALENTINE_PHOTOS?: {...}`) and both photo paths fail gracefully:

- **Site, all 8 days, creator + recipient flows, gift links (`#gift=`)** —
  work normally. Sharing is URL-hash-encoded, so it does not need KV.
- **Photo upload** (`POST /api/photos`) — returns `503 "KV storage binding
  not configured"`; the Creator aborts link creation with an inline error
  and keeps the draft.
- **Photo retrieval** (`GET /api/photos/<key>`) — returns `503 "KV storage
  binding not configured"`; recipient photo stages show the honest
  zero-photo path.
- **After the real KV IDs are added** — uploads and retrieval work, photos
  are kept 14 days (same as Wishora), no code change needed.

## 5. Verification (local, 25 Nov 2026, branch `feature/cloudflare-deploy`)

- `npm run lint` — 0 errors
- `npm run build` — passes (1040 modules; main chunk 559.88 kB / 189.78 kB
  gzip; lazy `RoseScene` chunk 950.06 kB / 255.04 kB gzip; same chunk-size
  warning as in PR #2)
- `npm test` — **39/39 pass**, 0 fail
- `wrangler deploy --dry-run` — passes (see §3). No real deploy was run
  (needs the user's Cloudflare auth).

## 6. Notes / deliberate non-changes

- The GitHub Pages workflow (`deploy-pages.yml`) from `birthday-experience`
  was **not** copied: it deploys a static mirror to GitHub Pages and is not
  part of the Cloudflare setup. Copying it would add a second hosting path
  without the Worker (no photo API). If a Pages mirror is wanted later, that
  is a separate decision.
- No source files were touched by this change — docs + config only. The
  Thorn stage, Rose stages, and all other features are untouched.
