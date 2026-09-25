# PRD — Grounded Legal Document Assistant (PromptWars Virtual, Exclusive Edition)

## Problem statement (verbatim scope)
"AI for Legal Assistance & Access" — help users understand, compare, and navigate
legal documents. Assist, don't replace, professional legal advice.

## Core design principle
Single constraint that differentiates this from every generic "chat with your PDF"
submission: **the model may never assert anything it cannot point to inside the
user's own uploaded document(s).** No external case law, no general legal advice
from training data. Every output carries a citation back to a page/clause id.
If the document doesn't contain the answer, the system says so explicitly
instead of guessing. This is the direct fix for the industry's current #1
unsolved legal-AI failure mode (fabricated/unverifiable claims).

## Feature map — all 7 listed use cases as views over one grounded engine

1. **Simplify complex documents** → plain-language summary, each point cited
   to source clause/page.
2. **Compare contracts/agreements/policies** → upload two docs, clause-level
   diff table (added / removed / changed obligations).
3. **Highlight clauses, obligations, risks, inconsistencies** → tagged pass
   over extracted clauses: `obligation` / `risk` / `inconsistency`, each cited.
4. **Answer questions on provided documents** → Q&A scoped only to the
   uploaded doc's extracted text; abstains ("not addressed in this document")
   when unanswerable.
5. **Help users understand options/next steps** → generated from the risk/
   obligation list — "what this means for you" panel.
6. **Generate summaries/checklists** → action checklist auto-derived from
   flagged obligations and risks.
7. **Prepare questions for a legal professional** → auto-compiled from every
   abstained answer and every high-risk flag — the one use case almost no
   competing team will bother building.

## Explicit non-goals (write these down so scope doesn't creep)
- No general legal Q&A ("what does X law say") — out of scope, this is the
  exact hallucination trap.
- No jurisdiction detection/case law lookups.
- No user account system / long-term document storage.

## Submission compliance checklist (from the invite + platform)
- [ ] Deployed live web app URL (Vercel)
- [ ] Public GitHub repo, under 10MB (`.gitignore` node_modules, no sample
      PDFs beyond 1-2 tiny fixtures, no vector index binaries)
- [ ] Walkthrough video, under 4 minutes, live screen testing shown
- [ ] No mandatory external AI vendor requirement on this track — Gemini API
      is a free stack choice here, not a compliance box
