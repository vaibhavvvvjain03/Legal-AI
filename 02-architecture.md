# Architecture — Grounded Legal Document Assistant

## Stack
- Next.js 14 (App Router) + TypeScript (strict mode) + Tailwind
- Gemini API (flash-tier model, cheap/fast enough for a hackathon) for
  extraction, comparison, and Q&A calls
- pdf-parse (or pdfjs-dist) for text + page-number extraction from uploaded
  PDFs; keep parsing lean, no OCR pipeline needed for typed contracts
- Zod for validating every structured LLM response before it touches the UI
- No database. No vector store. Session state only (React state / in-memory
  on the server for the duration of a request) — this is what keeps the repo
  under 10MB and removes an entire class of security concerns (nothing
  persists after the session ends)
- Deploy: Vercel

## Grounding engine (the core differentiator)
1. Parse uploaded doc → array of `{ id, page, text }` chunks (paragraph or
   clause-level).
2. Every LLM call receives ONLY these chunks as context, plus a strict system
   instruction: cite the exact `id` for every claim; if the answer isn't in
   the chunks, return `NOT_FOUND` instead of guessing.
3. Zod schema enforces the model returns `{ claim, citedChunkId, confidence }`
   shape — reject/retry on a malformed or uncited response rather than
   silently showing it.
4. UI renders citations as clickable references that jump to the highlighted
   source text — this is the "verifiable, not just plausible" UX that's the
   actual product wedge.

## Rubric coverage, explicitly
- **Security**: no doc persistence beyond session; rate-limit the upload/LLM
  endpoints; CSP headers; file-type/size validation on upload (reject
  anything not PDF/docx, cap file size).
- **Efficiency**: parse once, cache extracted chunks in session state, stream
  LLM output token-by-token instead of blocking on full completion.
- **Testing**: Jest for (a) the parser against 3-4 fixture docs of varying
  formatting quality, (b) the Zod schema rejecting a deliberately malformed
  LLM response, (c) the abstention path when a chunk set has no answer.
- **Accessibility**: semantic landmarks, labeled form controls, keyboard-
  navigable citation links, visible focus rings, WCAG-AA contrast on the
  palette.
- **Code Quality**: strict TS, no `any` on LLM response types, Zod as the
  single source of truth for shape.

## Repo hygiene for the 10MB cap
- `.gitignore`: `node_modules/`, `.next/`, `*.pdf` except 1-2 named fixtures
  under `test/fixtures/`
- No committed build artifacts
- Keep the fixture PDFs short (1-2 pages) — they're for tests, not demos
