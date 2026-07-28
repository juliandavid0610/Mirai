# Working with Live2D rigs

Everything you need to swap in your own character, plus the licensing reality
that shapes how this repo is laid out.

---

## Why nothing is vendored

Two separate constraints, often confused:

**The Cubism Core runtime is proprietary.** `live2dcubismcore.min.js` may not be
redistributed. It is loaded at runtime from Live2D's own CDN:

```
https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js
```

This is why the app briefly shows "Loading the Cubism runtime…" and why a strict
content blocker breaks the character but not the chat.

**The sample models are licensed, not free.** Haru, Mao, Hiyori, Natori and
Shizuku are © Live2D Inc. under the
[Free Material License](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html).
That licence permits use but not blanket redistribution, and it requires
attribution — which is why the credit line sits in the corner of the stage and
is not optional.

If you publish something built on this, read both agreements. They have
conditions tied to company size and revenue that the MIT licence on this repo
does not override.

---

## Adding your own model

### 1. Drop the files in

```
public/models/
└── my-character/
    ├── my-character.model3.json     ← the entry file
    ├── my-character.moc3
    ├── my-character.physics3.json
    ├── expressions/
    ├── motions/
    └── my-character.4096/           ← textures
```

`public/models/*` is git-ignored. Rigs are large binaries and usually carry
terms that forbid redistribution, so committing them is almost always a mistake.

### 2. Register it

In [`src/lib/live2d/catalog.ts`](../src/lib/live2d/catalog.ts):

```ts
{
  id: 'my-character',
  name: 'My Character',
  tagline: 'Shown in the picker.',
  url: '/models/my-character/my-character.model3.json',
  cubism: 4,
  credit: { author: 'You', license: 'Your licence', url: '' },
  transform: { scale: 0.9, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0 },
}
```

That is enough to make it load. Everything below is tuning.

### 3. Frame it

`transform.scale` is the fraction of the **stage height** the rig's canvas should
occupy. Rigs pad their canvas differently, so the visible character usually ends
up somewhat smaller than the number suggests — start at `0.9` and adjust while
watching.

| Field | Effect |
| --- | --- |
| `scale` | Size relative to stage height. Fitting by height, not width, keeps tall portrait rigs from overflowing on mobile. |
| `anchorX` / `anchorY` | `0.5, 0.5` centres. Lower `anchorY` pushes the character down. |
| `offsetX` / `offsetY` | Pixel nudge applied after anchoring. |

### 4. Map the expressions

Open the diagnostics overlay (Settings → Developer) and check whether
`expressions` reads `file` or `parameters`.

If your rig ships expression files, map them by emotion:

```ts
expressions: {
  neutral: 'exp_01',
  joy:     'exp_02',
  shy:     'exp_04',
  // any you omit fall back to the parameter pose
}
```

Expression names come from `FileReferences.Expressions[].Name` in the
`.model3.json`. Most rigs use opaque names like `f00`–`f07`, so stepping through
them one at a time is genuinely the fastest way to build the map.

**If your rig has no expression files at all, do nothing.** Hiyori is in the
catalog precisely because she is that case: the hand-tuned parameter poses in
`expression-map.ts` carry all nine emotions on their own.

### 5. Check the parameter names

The diagnostics overlay lists any parameters the rig ignored under `unmapped:`.
If a slot appears there, your rig names it differently. Override just that one:

```ts
parameters: {
  mouthOpen: 'ParamMouthOpen',   // instead of ParamMouthOpenY
  browLForm: 'ParamBrowLAngle',
}
```

The full slot list is `ParameterMap` in
[`src/types/live2d.ts`](../src/types/live2d.ts).

### 6. Wire up motions (optional)

```ts
motions: {
  neutral:   { group: 'Idle' },
  excited:   { group: 'TapBody', index: 0 },
  surprised: { group: 'TapBody', index: 1 },
}
```

Motions only fire for cues above `0.55` intensity — otherwise the character
gesticulates on every sentence, which gets tiring within about a minute.

---

## Cubism 2 rigs

Set `cubism: 2` and use the `.model.json` entry file. The legacy core is loaded
from jsDelivr, the parameter names switch to the `PARAM_MOUTH_OPEN_Y` family
automatically, and everything else behaves identically. Shizuku is in the catalog
to keep that path exercised.

---

## Troubleshooting

**"Could not find Cubism 2 runtime"** — something imported the combined
`pixi-live2d-display` entry. Import `pixi-live2d-display/cubism4` (or
`/cubism2`); the root bundle requires *both* runtimes at import time.

**The character loads but never moves** — a ticker was not registered before the
model was created. `loadPixiRuntime` calls `Live2DModel.registerTicker` for you;
if you construct a model outside it, do the same.

**Parameters get overwritten when a motion plays** — the write is happening too
early in the frame. All parameter writes must be inside `beforeModelUpdate`.

**The rig is enormous or invisible** — `transform.scale` is the fraction of stage
*height*. A value like `20` (pixels? units?) produces a very large character
very quickly.

**Nothing renders and the canvas is blank** — check WebGL is actually available.
In headless Chromium it is not, unless you pass
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, which is
exactly what `scripts/capture-screenshots.mjs` does.

**Textures are missing or 404** — paths inside `.model3.json` are relative to the
manifest. Keep the folder structure the exporter produced.

---

## Useful references

- [Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/)
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
- [Official sample data](https://www.live2d.com/en/download/sample-data/)
- [Cubism standard parameter list](https://docs.live2d.com/en/cubism-editor-manual/standard-parametor-list/)
