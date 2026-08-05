# Security

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/juliandavid0610/Mirai/security/advisories/new),
or email <daisukenagata0209@gmail.com>.

Include what you can reproduce, what it lets an attacker do, and the version or
commit. Expect a first reply within a few days.

## What this project's threat model actually is

Mirai is a self-hosted single-page app with four unauthenticated routes. There
are no accounts, no database and no server-side user data. Two things are worth
knowing before you deploy it publicly.

### Your API key is the asset

`AI_GATEWAY_API_KEY` is server-side only and never reaches the browser, but every
`/api/chat`, `/api/speech` and `/api/transcribe` request spends against it. A
public deployment is a public spending endpoint.

The built-in protection is a per-IP fixed-window rate limiter
(`MIRAI_RATE_LIMIT_REQUESTS`, default 30/minute/route). It is **in-memory and
per-instance** — across several regions each instance counts separately. If you
expose Mirai to the internet, put real auth or a shared-store limiter in front of
it. `src/lib/utils/rate-limit.ts` is one function to swap.

### The system prompt is partly user-controlled

Personas are editable in the UI and sent inline with each request, so the system
prompt is attacker-influenced on a public deploy. This is intentional — it is
what lets custom characters work without server-side storage.

Containment is in `src/lib/ai/schema.ts`: every string is length-bounded, every
array is size-bounded, and the model id is validated against an allow-list in
`src/lib/ai/models.ts` rather than passed through. Without that allow-list a
caller could route requests to any model your key can reach.

The realistic worst case is that someone gives themselves an odd chatbot on their
own screen. If you believe you have found something worse, that is exactly the
kind of report worth sending.

## Out of scope

- Model output itself. LLMs can be talked into saying things; that is a property
  of the models, not a vulnerability in this code.
- The Cubism runtime and sample rigs, which are Live2D Inc.'s software. Report
  those to Live2D.
- Anything requiring physical access to a user's device, since all state is in
  `localStorage` by design.

## Supported versions

The latest release on `main`. This is a single-developer project; older versions
are not patched.
