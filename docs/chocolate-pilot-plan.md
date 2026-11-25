# Chocolate Day pilot — The Sweet Heist (9 Feb)

Chocolate Day goes from 4 stages + finale to **7 stages + finale**, the same
pilot pattern Rose established and Propose generalized: one day at a time,
each stage a different physical gesture, photos in the middle, a fair final
gate, and a finale the recipient can replay and share. The concept is the
one the plan settled on after the Propose lesson ("interesting, not
confusing", "halka nahi sochna"): concrete objects known by touch — a shop
shutter, a pot of melted chocolate, a mould, a foil wrapper, a chocolate
you bite — and a sensory verb per stage. Every stage passes the
30-second test ("you stir the chocolate in circles until it melts").

## The 7 stages and their gates

| Stage | Name | Gesture | Gate |
| --- | --- | --- | --- |
| 1 | Lift the Shutter | Drag the shop shutter up (GSAP Draggable, vertical); warm kitchen light spills out, steam rises | Shutter dragged past 60%, or "Unlock the kitchen" (button / keyboard) |
| 2 | Temper the Drama | Turn the stove dial (Draggable rotation, arrow keys), then stir in real circles around the cauldron (pointer-angle accumulation, dotted guide + progress ring); the chocolate visibly melts (GSAP MorphSVG: solid bar → glossy puddle) as the temperature enters the sweet spot | Temp in 47–56° AND 6 full circles stirred; hold-to-stir + "Stir it for me" fallbacks |
| 3 | Pour the Mould | Pick a mould (heart / moon / chaos), then tilt the cauldron (Draggable rotation, arrow keys); the chocolate stream follows a motion path (MotionPathPlugin) and the mould visibly fills | Mould filled 100%; "Pour it for me" fallback |
| 4 | Dress the Bite | Drag toppings from the tray onto the chocolate (Draggable + Flip: the topping flies from the tray into place) | Any 2 toppings placed; tap-topping-then-tap-mould fallback |
| 5 | Photo Truffles | 1–4 photos as foil-wrapped truffles; tap unwraps the foil and opens the shared enlarge dialog; honest zero-photo path ("No photos tucked in this time — the chocolate carries it.") | ≥1 photo enlarged, or zero-photo path |
| 6 | Unwrap Three Truths | Peel a wrapper corner diagonally (Draggable peel, 70px threshold) to reveal the flavour opinion inside; tap-to-unwrap stays as fallback | Any 3 of 6 pieces peeled |
| 7 | Bite the Golden Centre | Hold to bite (shared `useHoldProgress`); the shell cracks at 33% / 66%, gold leaks out, at 100% it splits and the golden ticket slides out with `{reward}` | Hold reaches 100%; "Crack it for me" + Enter-to-crack fallbacks |

Finale (stage 8): "🍫 GOLDEN TICKET · FULLY EDIBLE FEELINGS", `{reward}` +
blockquote "`{tease}`" + "Sharing optional hai…" kept verbatim, "↻ Replay
the heist" and "Copy link" actions, and the photo fan fanned as truffles.

## Theme and voice

- Emoji 🍫 (the day's `symbol` in `App.tsx`; ◆ stays as the decorative
  glyph inside the pieces and the mould). Tokens `--cocoa-deep #3b1f14` /
  `--gold-foil #f2c14e` / `--cream #fff6ec` / `--berry #a8324e`.
- New `cocoaNight` ambience profile (warmer, lower, longer gaps than Rose's
  `nightGarden` and Propose's `starChoir`) + one-shots `playStir` /
  `playPeel` / `playCrack` / `playPour` in `src/lib/ambience.ts`.
  ChocolateExperience switches the singleton to `cocoaNight` on mount and
  restores `nightGarden` on unmount. (Pre-existing note: Rose/Propose never
  call `setProfile`, so their loops still play the default — out of scope
  for this pilot.)
- Same Hinglish voice as Rose/Propose. No Marathi anywhere.
- Video-like, not video files (plan §5A): the shutter light, the MorphSVG
  melt + bubbles, the pour stream, the foil glint and the crack are short
  looping GSAP/CSS/canvas animations — no `.mp4`, no downloaded GIFs or
  memes. The kitchen-cat cameo is original CSS artwork made for this
  project (stage 2 + finale); no third-party asset was used, so there is
  no source/permission record to file.
- Contrast: caramel `#e9954f` is a fill/accent only, never a text colour on
  cream; text sits on cocoa `#3b1f14` or cream `#fff6ec`. `:focus-visible`
  rings (gold on dark, cocoa on cream) are added for every new interactive
  element in `chocolate.css`.

## What Rose/Propose patterns it reuses

- **Photos**: the Wishora pattern as-is (Worker + KV, WebP, 1–4 photos,
  14-day retention footnote). Creator gets photo slots + Test Play via one
  `PHOTO_DAYS` entry (`src/lib/photoDays.ts`: rose, propose, chocolate).
- **Test Play**: the overlay's rose/propose ternary is refactored into a
  per-day map (`TEST_PLAY_EXPERIENCES` in `src/App.tsx`) — day 4 adds one
  entry and one map line. Rose/Propose render byte-identically through it.
- **Ambience**: one engine, per-day profiles; `cocoaNight` added, the two
  older profiles untouched (regression guards in
  `tests/chocolate-ambience.test.mjs`).
- **Gating**: `src/lib/chocolateGating.ts` mirrors `roseGating.ts` /
  `proposeGating.ts` — pure rules, `CHOCOLATE_STAGE_TOTAL = 7`,
  `CHOCOLATE_FINALE_STAGE = 8`, plus `countStirCircles` (partial circles
  don't count) and `angleStep` (shortest way round, sub-2° jitter ignored).
- **Finale**: the shared `Finale` `actions` prop with
  `replayLabel: '↻ Replay the heist'`; photo fan reuses the enlarge dialog.
- **`initialStage(CHOCOLATE_FINALE_STAGE)`** for the DEV `?journeyStage=`
  deep-link.

## The Experiences.tsx split (plan §11, decided for this pilot)

First commit on this branch: `src/Experiences.tsx` (1,610 lines) is split
into per-day files under `src/experiences/` — `RoseExperience`,
`ProposeExperience`, `ChocolateExperience`, `TeddyExperience`,
`PromiseExperience`, `HugExperience`, `KissExperience`,
`ValentineExperience` — moved verbatim, and `src/Experiences.tsx` becomes
an 8-line barrel re-exporting them so existing imports don't change.
One deviation from the plan's literal wording: the shared helpers do not
stay defined in `Experiences.tsx`. They live in
`src/experiences/shared.tsx` (components: `Icon`, `StageTop`,
`Celebration`, `Finale`, `SoftParticles`) and
`src/experiences/shared-hooks.tsx` (hooks/utils: `useHoldProgress`,
`usePhotoEnlarge`, `initialStage`, `prefersReducedMotion`,
`isWebGLAvailable`, `vibrate`) — keeping helpers in the barrel file would
have mixed component and non-component exports (react-refresh warnings)
and created an import cycle between the barrel and the day files. No
behaviour change: lint/build/test green on the split commit alone (65/65),
and the production bundle is near-identical (main chunk 587.60 kB /
199.58 kB gzip vs 587.58 kB / 198.56 kB gzip on main — the +1 kB gzip is
module-wrapper overhead from the extra files).

## What was cut

**3D is cut for Chocolate.** The MorphSVG melt in stage 2 *is* the visual
wow, in 2D, for no new dependency. No new dependencies at all;
`package.json` is untouched. GSAP's `MorphSVGPlugin`, `Flip` and
`MotionPathPlugin` ship inside the already-installed `gsap` package and
resolve at build time.

## Conflicts resolved (from the plan)

- **A — split touches all 8 days' files**: mechanical first commit, no
  behaviour change, verified green on its own (see above).
- **B — Test Play ternary**: refactored to a map (see above).
- **C — `:focus-visible` is 0 in `App.css`**: rings added in
  `chocolate.css` for shutter, dial, cauldron, toppings, truffles, pieces
  and the bite button.
- **D — MorphSVG import**: verified — `gsap/MorphSVGPlugin` resolves and
  the build passes with the melt wired in.
- **E — `wrangler.json` has no KV binding**: correct, and unchanged —
  this pilot does not re-add it (see Deferred).
- **F — circular-stir tracking**: angle accumulation with jitter filtering
  (`angleStep`), a visible dotted guide + progress ring, and the required
  hold-to-stir fallback.
- **G — pour tilt sync**: fill accumulates only while tilt ≥ 45°, so the
  stream, the tilt and the fill level always agree.

## Deferred (user's call, unchanged)

- **KV namespace**: `VALENTINE_PHOTOS` is not created in this pilot and
  `wrangler.json` is untouched — it has **no `kv_namespaces` block at all**
  (deleted in `d5e2bdd`). Photo upload fails gracefully at link-creation
  time (Creator aborts with a clear inline error, draft kept) until the
  user creates the namespace and the block is re-added with real IDs.
  Zero-photo gifts and Test Play work end-to-end today.
- **Deploy**: no wrangler/worker/workflow changes in this pilot.
- **CI workflow**: `.github/workflows/ci.yml` is re-attempted in this PR
  (same snapshot method as Rose/Propose); the outcome is recorded in the
  PR body. Earlier attempts failed 403 ("Resource not accessible by
  integration" — the GitHub App needs the `workflows` permission).

## Other changes in this PR

- The stale Propose test asserting `PHOTO_DAYS.has('chocolate') === false`
  and `PHOTO_DAYS.size === 2` is updated (chocolate is a photo day now;
  size 3, `teddy` is the not-yet-photo day).

## Verification (25 Nov 2026, branch `feature/chocolate-pilot`)

- `npm ci` — pass
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — tsc + vite pass; main chunk 640.00 kB / **219.40 kB
  gzip** (baseline on main `51e153b`: 587.58 kB / 198.56 kB gzip — eager
  delta **+20.84 kB gzip, above the plan's ~15 kB note threshold**).
  Drivers: the three newly-imported GSAP plugins (`MorphSVGPlugin`,
  `Flip`, `MotionPathPlugin` — eager, used by stages 2–4) plus the 7 new
  stages and `chocolate.css` (123.85 kB / 27.90 kB gzip, was 110.20 kB /
  25.44 kB gzip). No new dependency, no new lazy chunk; the lazy
  RoseScene 3D chunk is unchanged at 255.04 kB gzip. Flagged here rather
  than silently growing the bundle; a clip-path/scale melt fallback could
  drop MorphSVG later if the size is judged too much.
- `npm test` — **92/92 pass** (was 65/65 at PR #6; +27 new Chocolate
  tests: 13 gating, 7 ambience, 7 gift/codec)

## Not verified

- Live browser run of the stages (drag/stir/pour/peel physics, touch,
  MorphSVG melt on a real phone), Test Play focus trap in a real browser,
  actual photo upload end-to-end against a live Worker (needs the KV
  namespace + deploy).
- A Test Play pass of Rose and Propose in a real browser after the split
  commit (the split was verified by lint/build/tests + near-identical
  bundle output only — no live browser was available to this builder).
- Whether the cocoa-night loop sounds pleasant — no test can hear.
- Cloudflare deploy (needs merge + git integration).
