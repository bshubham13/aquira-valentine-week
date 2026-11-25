# Propose Day pilot — Written in the Stars (8 Feb)

Propose Day goes from 4 stages + finale to **7 stages + finale**, the same
pilot pattern Rose established: one day at a time, each stage a different
gesture, photos in the middle, a fair final gate, and a finale the recipient
can replay and share.

## The 7 stages and their gates

| Stage | Name | Gesture | Gate |
| --- | --- | --- | --- |
| 1 | Raise the Moon | Drag the moon up (GSAP Draggable, vertical); stars ignite as it rises | Moon dragged past 60% of the sky, or "Light the moon" (reduced-motion / button) |
| 2 | Cosmic Background Check | The 3 questions as swipe/flip cards — tap an answer or swipe the card left/right, it flies into the orb | All 3 answered |
| 3 | Draw the Constellation | Drag star to star; live gold line (GSAP DrawSVG), ghost dotted preview, twinkle + chime per star | All 5 stars connected in order |
| 4 | Pop the Nerves | Fling 3 nervous thoughts out of orbit (GSAP Draggable, fling + fade) or tap to pop | All 3 popped |
| 5 | Photo Stars | 1–4 photos as stars; tap to enlarge (Locket-style dialog); honest zero-photo path ("No photos tucked in — the sky is still yours") | Optional — always passable, no gate |
| 6 | The Sky Votes | Drag 3 verdict stars into their slots (or tap a slot to align); a verdict line appears per star | All 3 aligned |
| 7 | The Big Question | Magnetic Yes (GSAP quickTo) + dodging No | Yes tapped (launches a shooting-star streak + confetti) |

**The No dodges max 3 times, then surrenders** — exactly Rose's shy-thorn
rule. A gate must never be unwinnable: after the third dodge the No button
stops moving and reads "Okay fine… ask me again", and a tap then shows
"Even the stars agree — the only answer left is yes."

Finale (stage 8): the question as a keepsake, "Replay the proposal" and
"Copy the link" actions, and the photo fan when photos were included.

## Theme and voice

- Emoji 💍. Tokens `--sky-deep #1b1040` / `--star-gold #ffd97a`.
- New `starChoir` ambience profile (quieter, higher, sparser than Rose's
  `nightGarden`) in the generalized `src/lib/ambience.ts`.
- Same Hinglish voice as Rose. No Marathi anywhere.
- A CSS-only shooting star crosses the sky behind the content.

## What Rose patterns it reuses

- **Photos**: the Wishora pattern as-is (Worker + KV, WebP, 1–4 photos,
  14-day retention footnote). Creator gets photo slots + Test Play, like Rose.
  `Gift.photos` is day-agnostic — no shape change. The Creator's Rose-only
  gates (`rosePhotos`, `daySlug === 'rose'`) are generalized to a
  `PHOTO_DAYS` set (`src/lib/photoDays.ts`: rose, propose).
- **Ambience**: `src/lib/roseAmbience.ts` generalized to `src/lib/ambience.ts`
  with per-day profiles (`nightGarden` byte-identical for Rose, `starChoir`
  for Propose). One-shots `playTwinkle` / `playPop` / `playLaunch` added;
  `playSnip` / `playChime` retained (Rose regression tests still cover
  `nightGarden`).
- **Gating**: `src/lib/proposeGating.ts` mirrors `roseGating.ts` — pure rules,
  `PROPOSE_STAGE_TOTAL = 7`, `PROPOSE_FINALE_STAGE = 8`, `dodgeNo` with
  `NO_DODGE_LIMIT = 3`.
- **Finale**: one new optional `replayLabel` field on the Finale `actions`
  prop (default `"↻ Replay the rose"` — Rose renders identically).
- **initialStage()** is parameterized by stage total; `usePhotoEnlarge` takes
  a day-specific empty caption.

## What was cut

**3D is cut for Propose.** The constellation is a 2D line — Three.js / R3F
stays Rose-only. No new dependencies; `package.json` is untouched.

## Conflicts resolved (from the plan)

- **A — ambience file**: generalized, not duplicated. `roseAmbience.ts` is
  deleted; `App.tsx` and `Experiences.tsx` import `ambience`.
- **B — photo gates**: `PHOTO_DAYS` set in `src/lib/photoDays.ts`; the next
  day adds one word to the set.
- **C — contrast**: `.sky-instruction p` was `rgba(255,255,255,.48)` on the
  deep sky; Propose lifts it to `.78` in `propose.css`, and the photo-stage
  copy gets light colors there too.
- **D — stage totals**: `initialStage(maxStage)` takes the total; Rose
  passes its own, Propose passes its own.

## Deferred (user's call, unchanged)

- **KV namespace**: `VALENTINE_PHOTOS` keeps placeholder IDs in
  `wrangler.json` (user deferred creation). Photo upload fails gracefully
  until he creates the namespace — no code change needed then.
- **Deploy**: no wrangler/worker/workflow changes in this pilot.

## Verification (25 Nov 2026, branch `feature/propose-pilot`)

- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — tsc + vite pass; default base `/` in `dist/index.html`
  (`/assets/index-BQ9rYP-3.js`); main chunk 587.58 kB / 198.56 kB gzip
  (was 559.88 kB / 189.78 kB gzip — the growth is the 7 new Propose stages;
  the lazy RoseScene 3D chunk is unchanged at 255.04 kB gzip)
- `npm test` — **65/65 pass** (was 39/39 before this change; +26 new
  Propose tests: gating, ambience profiles, gift/photo rules)
