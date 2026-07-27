# Architecture

How a message becomes a moving face, and why each piece is where it is.

---

## The shape of it

```mermaid
flowchart TB
  subgraph client["Browser"]
    composer["Composer<br/><small>text · microphone</small>"]
    chatHook["useMiraiChat<br/><small>orchestrates everything</small>"]
    parser["parseDirectives()<br/><small>streaming-safe</small>"]
    transcript["Transcript"]
    stage["MiraiStage<br/><small>PixiJS + Cubism</small>"]
    voice["VoicePlayer<br/><small>AnalyserNode</small>"]
  end

  subgraph server["Route handlers"]
    chat["/api/chat"]
    speech["/api/speech"]
    transcribe["/api/transcribe"]
    caps["/api/capabilities"]
  end

  gateway[["Vercel AI Gateway"]]

  composer --> chatHook
  chatHook -->|UIMessage[]| chat
  chat --> gateway
  gateway -->|SSE| chatHook
  chatHook --> parser
  parser -->|clean text| transcript
  parser -->|EmotionCue[]| stage
  parser -->|reply text| voice
  voice --> speech
  speech --> gateway
  voice -->|amplitude 0..1| stage
  composer -.->|no SpeechRecognition| transcribe
  caps -.->|boots the client| chatHook
```

Everything that touches the character goes through **one hook**
(`useMiraiChat`) and **one stage handle** (`StageProvider`). That is deliberate:
the transcript and the face are derived from the same parse of the same text, so
they cannot disagree about what was said.

---

## Layers

| Layer | Path | Knows about |
| --- | --- | --- |
| Types | `src/types` | Nothing. Pure data shapes. |
| Utilities | `src/lib/utils` | Nothing app-specific. |
| Live2D engine | `src/lib/live2d` | Cubism, PixiJS. **Not** React, not the AI layer. |
| AI | `src/lib/ai` | Prompts, personas, the directive protocol. **Not** the DOM. |
| Audio | `src/lib/audio` | Web Audio, Web Speech. |
| Stores | `src/lib/store` | The above. Zustand, no React imports. |
| Hooks | `src/hooks` | Everything. This is where React enters. |
| Components | `src/components` | Hooks and stores only. |

The engine layer has no React dependency at all, which is what makes it testable
in a plain Node process and reusable outside this app.

---

## The frame loop

`MiraiStage` subscribes to the internal model's `beforeModelUpdate` event and
does all its work there. The Cubism update order is:

```
motion → expression → physics → beforeModelUpdate → coreModel.update()
```

`beforeModelUpdate` is the last hook before the rig is flushed, so it is the only
place a parameter write is guaranteed to survive. Writing from a PixiJS ticker
callback appears to work right up until a motion starts playing, at which point
the motion system overwrites everything and the bug looks intermittent.

Per frame, in order:

1. **Ease the pose.** Every slot damps toward its target, so an emotion change is
   a transition rather than a cut.
2. **Idle sway.** Three sine waves with incommensurable periods, damped while
   speaking. The character calms down when it is talking to you.
3. **Focus.** Pointer position, pre-damped, handed to `model.focus()`.
4. **Write the pose**, each slot using its declared blend mode.
5. **Lip sync last**, so nothing can stomp on the mouth.

### Blend modes

`SLOT_BLEND` in `expression-map.ts` declares how each semantic slot combines with
what the rig already wrote:

| Mode | Slots | Why |
| --- | --- | --- |
| `add` | `angleX/Y/Z`, `bodyAngleX` | An emotional head-tilt rides on top of pointer tracking instead of cancelling it. |
| `multiply` | `eyeLOpen`, `eyeROpen` | A half-lidded `sleepy` face still blinks. Absolute writes freeze the eyelids and kill auto-blink. |
| `set` | everything else | The straightforward case. |

Rest values follow the mode: `0` for `add` (additive identity) and `1` for
`multiply` (multiplicative identity). That correspondence is asserted in
`tests/expression-map.test.ts`, because getting it backwards produces a
character with permanently closed eyes and no obvious cause.

---

## The directive protocol

The model punctuates its reply with `[[emotion]]` or `[[emotion:intensity]]`.

**Why not a tool call or structured output?** Both arrive after the text. The
face would react a beat late, every time. Inline markers stream with the words
they belong to, work with any provider that can follow an instruction, and
degrade to a perfectly normal reply if the model ignores them.

**The hard part** is that the parser runs against accumulated, partial text on
every chunk. `parseDirectives` therefore:

- withholds any trailing fragment that could still become a directive
  (`[[jo`, `[[joy:0.`, `[[joy:0.9]` — note the single closing bracket, which is a
  real chunk boundary that occurs often);
- distinguishes an unfinished tag from prose that merely contains brackets, by
  only looking at the last 24 characters and requiring the fragment to match a
  directive prefix;
- leaves code spans and fenced blocks entirely alone, including their whitespace,
  so the assistant can talk about its own protocol and so code indentation
  survives;
- records each cue's offset **into the cleaned text**, which lets the UI fire a
  cue exactly when the words carrying it have been revealed.

That last point is what makes `cueAt(cues, revealedCharacters)` possible, and it
is the difference between a face that changes mid-sentence and one that changes
when the reply ends.

---

## Degradation

Every external dependency has a defined failure mode. None of them is a 500.

| Missing | Behaviour |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Rehearsal Mode: scripted replies streamed through the identical chunk sequence, clearly labelled in the UI. |
| Speech model | `/api/speech` returns `204`; the client uses browser `SpeechSynthesis` and a text-estimated mouth envelope. |
| `SpeechRecognition` | The mic records a clip and posts it to `/api/transcribe`. |
| Transcription model | `/api/transcribe` returns `501` and the mic button reports it. |
| `localStorage` | Settings live in memory for the session. |
| Cubism CDN | The stage shows a named error and a retry that rebuilds the WebGL context from scratch. |
| Expression files | The rig runs on parameter poses alone. |
| A rig parameter | Recorded once, never retried, surfaced in the diagnostics overlay. |

---

## Security notes

- The client chooses the model, so `resolveModelId` validates against an
  allow-list. Passing an arbitrary string through would let a caller route
  requests to any model the deployment's Gateway key can reach.
- Personas are user-editable and sent inline, which makes the system prompt
  partly attacker-controlled on a public deploy. `personaSchema` bounds every
  string length and array size; the worst case is a caller giving themselves a
  strange chatbot on their own screen.
- Rate limiting is in-memory and per-instance — enough to stop casual abuse of a
  single deployment. Swap `rate-limit.ts` for a shared store if you run several
  regions.
- Memory is stored only in the browser and sent per request. Nothing is retained
  server-side after the response.

---

## Dependency pinning

`pixi.js` is pinned to `^6`. `pixi-live2d-display@0.4.0` declares peer
dependencies on `@pixi/*@^6`, which npm installs. Adding PixiJS 7 on top
resolves **two** copies of `@pixi/core`, and a v6 `Container` added to a v7 stage
fails at runtime with an error that points nowhere near the cause.

The Cubism runtime is imported through its version-specific entry
(`pixi-live2d-display/cubism4`), never the combined root entry — the root bundle
pulls in the Cubism 2 half, which throws at import time unless `live2d.min.js` is
already on `window`.
