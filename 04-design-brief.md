# Design Brief — Grounded Legal Document Assistant

## Subject
A tool for reading real contracts/agreements, where every AI-generated claim
is traceable to the exact clause it came from. The citation link IS the
product's differentiator — the UI must make that visible and central, not a
footnote to a chat interface.

## Color tokens
- `--paper: #EFEDE6` — base background (stone paper, not cream/terracotta)
- `--ink: #1F2937` — body text (soft slate-black, not pure #000/#111)
- `--obligation: #2C3E63` — navy, used for obligation-type tags
- `--risk: #B33A3A` — muted brick red, used ONLY for flagged risk/inconsistency tags
- `--citation: #B8860B` — dull gold, used ONLY for citation markers/links — this
  color must not appear anywhere else in the UI, so it stays meaningful
- `--verified: #3F6B4C` — muted sage, used for resolved/confirmed states
- Keep contrast WCAG-AA against `--paper`.

## Typography
- Document viewer pane: "Source Serif 4" — this is literally how the source
  contract reads, respect it.
- Everything else (labels, buttons, nav, AI panel prose): "Public Sans."
- No third typeface. No monospace anywhere (this isn't a code/data product).
- Line length under 80 characters in both panes.

## Layout
Two-pane, fixed split, not cards:
```
+----------------------+----------------------+
| ¶1  [document text]  | Summary / Risks / Q&A|
| ¶2  [document text]  |  "...claim... [¶2]"   |
| ¶3  [document text]  |  "...claim... [¶7]"   |
+----------------------+----------------------+
```
- Left pane: uploaded document, continuous scroll, clause numbers in the
  left margin (this is where "¶14" style citations point to).
- Right pane: AI output. Every sentence that makes a claim ends with a small
  citation marker in `--citation` gold, styled as a legal footnote ref
  (e.g. `[¶14]`), not a chat-bubble timestamp.
- Clicking a citation marker smooth-scrolls the left pane to that clause and
  briefly highlights it (background flash, ~600ms, fades out) — this is the
  ONE motion moment in the whole app. No hover-lift on cards, no staggered
  entrance animations, no gradient washes.
- Risk/obligation tags render as small bordered labels (hairline border,
  sentence case, colored text on transparent background) — not rounded
  pills with fills.

## Explicitly avoid
- Rounded-pill badges, drop shadows, ALL-CAPS eyebrow labels
- Gradient accents or hero sections
- `→` appended to button/link text
- A card grid — this product is a document, not a dashboard

## Accessibility floor (non-negotiable, build in from the start)
- Every citation marker is a real `<button>` or `<a>`, keyboard-reachable,
  with a visible focus ring in `--obligation` navy
- Semantic landmarks: `<main>`, `<nav>`, `<aside>` for the two panes
- `prefers-reduced-motion` disables the scroll-highlight animation
