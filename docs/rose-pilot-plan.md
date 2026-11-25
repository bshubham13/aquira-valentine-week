# Rose Day pilot — build notes

**Branch:** `feature/rose-pilot` · **Pilot day:** Rose Day (7 Feb) · **Status:** built, PR only — no merge without approval.
**Plan:** `~/workspace/valentine-rose-pilot-plan.md` · **Library research:** `~/workspace/valentine-animation-research.md`

Rose is the pilot for the Valentine Week upgrade: the Love Arcade home stays
exactly as-is, the other 7 days are untouched, and Rose's inside is rebuilt
from a form-like scroll into 7 alive, gated stages + a finale, with photos,
a Test Play preview, and the honesty fixes (H1–H5) folded in.

## Concept — "The Bloom Room"

- Hook kept verbatim: a rose chose `{to}` — not a normal bouquet, "thode
  nakhre wala, kaafi pretty, aur suspiciously personal".
- Rosie the rose is the host: shy, negotiable, a little dramatic. All Rosie
  lines and finale copy are verbatim from the original; only instruction
  lines changed where the mechanics changed.
- World tokens (`src/rose.css`): `--rose-deep: #7a1030`, `--garden: #22473a`,
  `--moon: #fff6e8`. Accent `#ff315f` / soft `#ffd3df` kept. Symbol `❀`.
- Hinglish voice throughout. No Marathi.

## The 7 stages (+ finale)

Each stage is a different gesture. Every drag/hold/3D gesture has a
button/tap alternative, a keyboard path, and a reduced-motion fallback
(GSAP skipped, instant/opacity-only). Gating is pure and shared:
`src/lib/roseGating.ts` (`canAdvanceRose` / `nextRoseStage`,
`ROSE_STAGE_TOTAL = 7`, `ROSE_FINALE_STAGE = 8`).

| # | Stage | Interaction | Gate |
|---|-------|-------------|------|
| 1 | Garden Gate | GSAP Draggable (x, 0–160, Inertia) swings both panels (rotateY); snap open ≥ 60% else elastic snap-back. "Knock twice" button alternative. | gate open |
| 2 | Thorn Negotiation | 4 thorns draggable off (fling > 48 px removes) or tap; keyboard Enter/Space. **Shy Thorn (index 3)** dodges pointer (hover desktop, tap touch) max 3 times, then surrenders; keyboard always removes. Snip sound + vibrate per removal. | 4 removed |
| 3 | Wake the Bouquet | Moonbeam follows the pointer (`gsap.quickTo`); roses bloom under it; tap-to-plant stays. Small confetti petal burst per bloom. | 5 of 7 bloomed |
| 4 | Press the Moments | 3 note cards Draggable + `hitTest` on the bouquet drop zone (drop-hot highlight); tucked cards fly to the bouquet (GSAP) and reappear as tucked lines. Tap alternative: tap card, tap bouquet. | 3 tucked |
| 5 | Tie the Ribbon | Hold-to-wind via `useHoldProgress` driving an SVG ring (r=70, C≈440); "Tie it for me" animates wind to 100; bow pops elastic on completion; Space hold works. | wind 100% |
| 6 | Photo Petals | 1–4 polaroids fan in (GSAP stagger); tap enlarges via native `<dialog>` (Escape/backdrop close, focus restore). Lazy 3D blooming rose (`RoseScene`, bloom = viewed/total) behind the fan when WebGL is available and motion is not reduced; 2D CSS rose otherwise. **Zero-photo honest path:** "No photos tucked in this time — the words carry it", Continue enabled immediately. | ≥ 1 viewed, or 0 photos |
| 7 | Hold to Deliver | Hold drives the bouquet along a moonlit SVG path (`MotionPathPlugin`); release before 100% resets with a bounce; completion plays a chime + vibrate once. | delivery 100% |
| 8 | Finale | Shared `Finale` with optional `actions` (Replay + Copy link — Rose only). Badge "🌹 HAND-DELIVERED · ONE OF ONE", existing copy verbatim, photo fan (tap to enlarge), confetti petal bursts on mount (skipped for reduced motion). | — |

Shared pieces: `usePhotoEnlarge` (dialog hook, used by stage 6 + finale fan),
`useHoldProgress` (pointer/space hold with a 400 ms grace window),
`prefersReducedMotion()` / `isWebGLAvailable()` / `vibrate()` guards.

## Honesty fixes (H1–H5)

- **H1 — real sound:** `src/lib/roseAmbience.ts`. Synthesized "night garden"
  loop (filtered noise + sparse C-major pentatonic chimes, master gain 0.14),
  AudioContext created lazily on a user gesture only (Home toggle, door open).
  Mute is real (`suspend()`/`resume()`). One-shots `playSnip()` (thorn) and
  `playChime()` (delivery) work even when the loop is off. No audio files.
  The Home toggle and the in-experience ♪ button both drive the same
  singleton; leaving an experience stops the loop.
- **H2 — draft restore:** `loadDraft()` in `src/lib/giftCodec.ts` restores the
  Creator draft on mount (shape-checked; corrupt drafts ignored). Autosave on
  every change. Label now reads "Your magic is saved locally — and restored
  when you return".
- **H3 — no factory prefill:** Creator inputs start empty. Fallbacks are
  applied at gift-build time (`applyGiftFallbacks`): "My favourite human" /
  "Someone who adores you" / "You make the ordinary feel special." A draft
  holding exactly Aashi/Kabir + the sample message is treated as a factory
  prefill and ignored.
- **H4 — validation + caps:** `validateGift` / `encodeGift` /
  `decodeGift` in `src/lib/giftCodec.ts`. Caps: to/from 40, message 280,
  extra 200, caption 80, photos 4, rose colour from the 4-option list.
  `encodeGift` throws on violation; `decodeGift` returns `null` on anything
  invalid. Share URLs over 2,000 chars show a warning on the complete screen
  (`SHARE_URL_WARN_LENGTH`).
- **H5 — honest photo copy:** Rose footnote: "Your words stay inside the
  link. Photos are stored privately for 14 days, then deleted." Other days
  keep the old "Nothing is uploaded." copy.

## Photos (Wishora pattern, new binding)

- `src/photos.ts`, `src/utils/photoUpload.ts`, `src/utils/photoCompressor.ts`
  ported as-is from Wishora: compress client-side (WebP 0.90, longest side
  2048 px, max 3 MB stored; original max 5 MB), sequential upload to the
  Worker, photos referenced by `photoKey` in the URL-hash gift.
- Worker: `src/worker/index.ts` + `src/worker/validation.ts` (magic bytes,
  3.5 MB request ceiling, origin allowlist for Valentine hosts, 14-day
  retention, in-memory rate limit). Binding `VALENTINE_PHOTOS`.
- **KV namespace is NOT created yet.** The wrangler binding holds placeholder
  IDs (`00000000000000000000000000000000`). The user must run, with his own
  Cloudflare login:
  `npx wrangler kv namespace create VALENTINE_PHOTOS` and
  `npx wrangler kv namespace create VALENTINE_PHOTOS --preview`,
  then paste the returned IDs into `wrangler.json`. Uploads will fail until
  then — the Creator aborts link creation with an inline error and keeps the
  draft if an upload fails.
- Creator photo UI (Rose only): 1–4 photos, captions ≤ 80 chars, thumbnails
  via object URLs, per-photo progress ("Uploading photo N of M…"), remove
  button. Test Play uses the same draft gift with `previewPhotos` object URLs
  — no upload needed to preview.

## Test Play (Creator, Rose only)

"▶ Test Play — see it like they will" opens an immersive preview dialog
(`role="dialog"`, `aria-modal`, focus trap with Tab cycling, Escape closes,
focus returns to the Test Play button) rendering the real `RoseExperience`
from the draft gift. HUD: "🌹 Live Preview: Rose Day", Start over (remount),
Exit ×. Closing returns to the Creator with the draft intact. In Test Play
the finale's Copy link is hidden (there is no real share URL yet); Replay
works.

## Libraries (all free)

GSAP 3.13+ (Draggable, Inertia, MotionPath, Flip-free tuck via plain tween),
motion/react via `LazyMotion` (stage transitions only), Three.js +
@react-three/fiber v9 + drei v10 for **one** lazy 3D moment (stage 6),
canvas-confetti, native Web Audio / Vibration. No Rive, no Spline, no paid
dependency. `Experiences.tsx` was **not** split in this pilot.

Bundle (production build): main `index-*.js` 559.88 kB / 189.78 kB gzip
(GSAP + motion + confetti eager — above the plan's ~55 kB eager target; the
eager set is shared by the whole app and was accepted for the pilot, revisit
if the other days add more); `RoseScene-*.js` lazy chunk 950.06 kB /
255.04 kB gzip (at the ~252 kB ceiling; loads only on stage 6 with WebGL).

## Files

| File | What |
|---|---|
| `src/Experiences.tsx` | RoseExperience rewrite (7 stages + finale), `Finale` optional `actions` prop, `initialStage` cap raised to 8, GSAP/motion/confetti wiring, `useHoldProgress`, `usePhotoEnlarge` |
| `src/rose.css` | Rose theme tokens, gate/ribbon/photo/delivery styles, dialog, Test Play overlay, photo-upload slots, reduced-motion rules |
| `src/RoseScene.tsx` | Lazy 3D blooming rose (fiber + drei OrbitControls, procedural petals, `bloom` prop) |
| `src/lib/roseAmbience.ts` | Real Web Audio night-garden loop + one-shots (H1) |
| `src/lib/giftCodec.ts` | Codec, validation, caps, fallbacks, draft save/load (H2–H4); Node-testable (explicit `.ts` import) |
| `src/lib/roseGating.ts` | Pure stage-gating rules |
| `src/App.tsx` | Creator rewrite (draft restore/autosave, photo upload, Test Play), recipient door starts ambience, experience sound toggle, real `encodeGift`/`decodeGift` |
| `src/photos.ts`, `src/utils/photoUpload.ts`, `src/utils/photoCompressor.ts`, `src/worker/*`, `wrangler.json` | Photo port (step b) — placeholder KV IDs |
| `package.json`, `package-lock.json`, `vite.config.ts` | Deps (gsap, motion, three, fiber, drei, canvas-confetti), `/api` dev proxy |
| `tests/rose-gift.test.mjs`, `tests/rose-stages.test.mjs`, `tests/photo-compressor.test.mjs`, `tests/worker-photos.test.mjs`, `tests/rose-ambience.test.mjs` | 39 tests (Node built-in runner) |
| `.github/workflows/ci.yml` | CI (lint + build + test) — **in local commit only; could not be pushed** (see below) |
| `tests/smoke.test.mjs` | Pre-existing harness test |

## Verification (local, 25 Nov 2026)

- `npm ci` — pass
- `npm run lint` — pass (0 errors, 0 warnings)
- `npm run build` — pass (tsc + vite; RoseScene split into its own lazy chunk)
- `npm test` — **39/39 pass** (smoke 1, rose-gift 11, rose-stages 9, photo-compressor 5, worker-photos 7, rose-ambience 6)
- `compressPhoto` cannot be tested in Node (needs document/canvas) — the
  test asserts it rejects without a DOM and says so honestly.

## Not verified

- Live browser run of the stages (drag physics, touch, WebGL on a real
  phone), Test Play focus trap in a real browser, actual photo upload
  end-to-end against a live Worker (needs the KV namespace + deploy).
- Whether the night-garden loop sounds pleasant — no test can hear.
- Cloudflare deploy (needs merge + git integration).

## Caveats for the PR

1. **CI workflow not on the remote.** `.github/workflows/ci.yml` is in local
   commit `bbfc06b` but every snapshot push failed with 403 "Resource not
   accessible by integration" — workflow files need the GitHub App's explicit
   `workflows` permission. It needs a credentialed git push or the App
   permission; do not retry blindly.
2. **Remote history differs from local.** The branch was published via
   GitHub-connector snapshot pushes (5 snapshot commits, same content,
   different history). Never force-push without asking the user.
3. **Placeholder KV IDs** in `wrangler.json` (see Photos above).
4. **Eager bundle** is larger than the plan target (see Libraries above).
