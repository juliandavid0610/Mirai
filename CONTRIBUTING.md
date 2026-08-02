# Contributing

Thanks for looking. This is a small, opinionated project — here is what you need
to know to make a change that lands.

## Getting set up

```bash
npm install
npm run dev
```

No key required. The app boots into Rehearsal Mode, which exercises the entire
pipeline (streaming, directive parsing, expressions, lip sync) with scripted
replies. Most work does not need a model at all.

## Before you open a PR

```bash
npm run typecheck   # strict, with noUncheckedIndexedAccess
npm run lint
npm test
```

CI runs exactly these plus a production build.

## House style

**Comments explain why, never what.** `// increment i` is noise. `// the mouth
has to close slower than it opens or it reads as flapping` is the reason the
next person does not "simplify" the code back into a bug. If a line looks odd,
say what it is defending against.

**Keep the layers apart.** `src/lib/live2d` knows about Cubism and PixiJS and
nothing else — no React, no AI. `src/lib/ai` knows about prompts and never
touches the DOM. React enters at `src/hooks`. This is what keeps the engine
testable in a plain Node process.

**No new dependency without a reason in the PR body.** The dependency list is
short on purpose. A 40KB markdown renderer for text the prompt explicitly
discourages from using markdown is the kind of trade this project says no to.

**Degrade, don't throw.** Every external dependency here has a defined failure
mode that is not a crash: no key, no speech model, no microphone permission, no
`localStorage`, no WebGL, a rig missing a parameter. New code should follow that.

## Testing

Tests live in `tests/` and run against `src/lib`. The bar is not coverage, it is
whether a regression would otherwise be invisible:

- Does it survive **partial** input? The directive parser is fed one character
  at a time in its test, because that is what streaming actually does.
- Is it **frame-rate independent**? `damp()` is tested at 60 Hz and 144 Hz
  specifically.
- Can it produce **NaN**? A NaN reaching a Cubism parameter corrupts the rig for
  the rest of the session, so numeric paths are tested with hostile input.

If you fix a bug, add the test that would have caught it. `tests/stores.test.ts`
has a good example: a guard on the zustand selector that once caused an infinite
render loop.

## Working on the Live2D engine

Check your change against rigs that differ meaningfully, and say which in the PR:

| Rig | Covers |
| --- | --- |
| Haru, Mao | Expression files, Cubism 4 |
| Hiyori | **No** expression files — the parameter-pose path |
| Natori | Semantically named expressions |
| Shizuku | Cubism 2, the legacy runtime and parameter names |

Turn on the diagnostics overlay (Settings → Developer) while you work. The
mouth-parameter bar is the fastest way to tell whether lip sync is following
audio or guessing, and `unmapped` tells you what a rig silently ignored.

## Adding a persona or a rig

Personas are plain data in `src/lib/ai/personas.ts`. Write concrete, checkable
speech rules — "lead with the answer" beats "be concise", which every model
already believes it is doing.

Rigs go in `src/lib/live2d/catalog.ts`. **Do not commit model files.**
`public/models/*` is git-ignored because rigs are large binaries and almost
always carry terms that forbid redistribution. See
[`docs/LIVE2D.md`](docs/LIVE2D.md).

## Commits

Present tense, imperative, one concern each:

```
Add a noise gate to the lip-sync driver
Fix directive fragments leaking during streaming
```

## Regenerating the README assets

```bash
npm run build && npm start
node scripts/capture-screenshots.mjs
node scripts/capture-demo.mjs   # needs ffmpeg-static or a system ffmpeg
```

Both drive the real app in a headless browser. Nothing in the README is a mockup.
