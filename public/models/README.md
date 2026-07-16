# Local Live2D models

Drop your own Cubism rigs in this folder. Each model gets its own directory:

```
public/models/
└── my-character/
    ├── my-character.model3.json
    ├── my-character.moc3
    ├── my-character.physics3.json
    ├── expressions/
    ├── motions/
    └── textures/
```

Then register it in `src/lib/live2d/catalog.ts`:

```ts
{
  id: 'my-character',
  name: 'My Character',
  tagline: 'Something short for the picker.',
  url: '/models/my-character/my-character.model3.json',
  cubism: 4,
  credit: { author: 'You', license: 'Your licence', url: '' },
  transform: { scale: 0.42, anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0 },
}
```

Everything in this folder except this file is git-ignored — rigs are large
binary bundles and are almost always licensed in a way that forbids
redistribution. See [`docs/LIVE2D.md`](../../docs/LIVE2D.md) for the full guide,
including how to map expressions and tune the parameter fallback.
