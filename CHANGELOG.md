# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-09-20

### Changed

- **Lifted the whole palette.** The background moves from a near-black
  `oklch(0.14 …)` to a deep indigo `oklch(0.265 …)`, with the panel, border and
  muted-text steps raised to match. Near-black reads as dramatic for a minute
  and gloomy for an hour, and it flattened the glass panels: over a near-black
  page a 72%-opaque surface is visually indistinguishable from the page itself.
  Panel opacity dropped to 60% at the same time, so the aurora now reads
  *through* the glass — which is the point of using glass rather than a flat
  fill.
- Aurora washes are brighter and gained a warm floor glow; the vignette no
  longer claws back most of the brightness at the edges.
- Emotion accents are a few points brighter and more saturated, so they still
  carry against the lighter surfaces.
- **New app icon.** The old mark was a dark tile, which disappeared against the
  light browser chrome and gallery cards it mostly sits on. The replacement is a
  bright violet-to-cyan tile with a face — readable at 16px, where an abstract
  glyph is not — and it is now also the mark in the top bar, with the emotion
  colour moved to the halo around it.
- **Hiyori is the default rig**, replacing Haru. She is brighter, and she ships
  no expression files, so the default view permanently exercises the
  parameter-pose fallback instead of hiding it behind the model picker.
- Open Graph card and `theme-color` follow the new palette.

## [1.0.0] — 2026-08-05

First stable release.

### Added

- Persona system with four complete built-in characters, plus creation,
  duplication and editing of custom ones.
- On-device memory: facts are sent with each request and stored only in the
  browser.
- Diagnostics overlay reporting FPS, emotion, the live mouth parameter and any
  rig parameters that failed to map.
- `GET /api/capabilities`, so the client boots against what the deployment can
  actually do instead of guessing.
- Headless capture scripts that regenerate every README screenshot and the demo
  GIF from the running app.
- Reduced-motion support that stops idle sway and pointer tracking while keeping
  lip sync and expressions.

### Changed

- Default rig is now Haru, and every rig in the catalog was reframed — the
  previous scales left the character noticeably undersized on the stage.
- Directives inside inline code spans and fenced blocks are left untouched.
  Previously an assistant explaining its own protocol produced the baffling
  output "inline `` markers".
- Cubism runtimes are imported through their version-specific entry points.
  The combined entry pulls in the Cubism 2 half, which throws at import time
  unless the legacy core is already on `window`.

### Fixed

- Directive fragments split across stream chunks no longer flash on screen; the
  parser withholds anything that could still become a tag, including the
  single-closing-bracket case `[[joy:0.9]`.
- Infinite render loop from a zustand selector that built a new array on every
  call. Guarded by a test.
- Syllable estimation counted vowel runs in pairs, so "beautiful" scored four
  beats instead of three and lip sync ran fast on vowel-heavy text.
- Trailing whitespace left behind when a removed directive ended a message.

## [0.3.0] — 2026-07-12

### Added

- Voice output: neural TTS through the Gateway, with browser `SpeechSynthesis`
  as the keyless fallback.
- Amplitude-driven lip sync via `AnalyserNode`, and a syllable-estimated envelope
  for the browser path, which exposes no audio stream by design.
- Voice input: `SpeechRecognition` where available, `MediaRecorder` plus
  server-side transcription where it is not.
- Settings drawer with expressiveness, idle motion, pointer tracking and voice
  controls.

### Changed

- Lip sync gained a noise gate, asymmetric attack/release and a decaying peak
  ceiling. A direct RMS-to-jaw mapping never fully closed the mouth between
  words and read as a permanent slack jaw.

## [0.2.0] — 2026-06-18

### Added

- Inline `[[emotion:intensity]]` directive protocol, parsed as the reply streams
  so the face changes on the word it was written for rather than at the end.
- Emotion-to-expression mapping with a hand-tuned Cubism parameter fallback for
  rigs that ship no expression files.
- Per-slot blend modes — `add` for head angles, `multiply` for eye-open, `set`
  for the rest — so emotions coexist with pointer tracking and auto-blink
  instead of overwriting them.
- Rehearsal Mode: scripted replies streamed through the identical chunk sequence
  when no model key is configured.
- Live emotion theming; the whole interface derives from one CSS variable.

## [0.1.0] — 2026-05-09

### Added

- Live2D stage on PixiJS with Cubism 2 and Cubism 4 support, model catalog and
  runtime switching.
- Streaming chat through the AI SDK and the Vercel AI Gateway.
- Secondary idle motion on three incommensurable sine waves, plus smoothed
  pointer-driven head tracking.
- Glassmorphism UI shell, responsive from phone to desktop.

[1.1.0]: https://github.com/juliandavid0610/Mirai/releases/tag/v1.1.0
[1.0.0]: https://github.com/juliandavid0610/Mirai/releases/tag/v1.0.0
[0.3.0]: https://github.com/juliandavid0610/Mirai/releases/tag/v0.3.0
[0.2.0]: https://github.com/juliandavid0610/Mirai/releases/tag/v0.2.0
[0.1.0]: https://github.com/juliandavid0610/Mirai/releases/tag/v0.1.0
