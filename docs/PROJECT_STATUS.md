# Project Status — Digital PR Outreach MVP

**Last updated:** 2026-06-05
**Purpose of this doc:** a complete handoff snapshot so a new Claude session (or
any developer) can pick up exactly where things are without re-reading the whole
history.

---

## 1. What this product is

A **single-session, stateless web tool** that turns a campaign research-report PDF
into up to 200 personalised journalist pitch emails, runs a 22-check quality
rubric over them, and exports an AppScript-ready CSV.

Core loop: **PDF in → generation prompt + data-facts summary out → personalised
emails out → quality verdict out → CSV out.**

No login, no database, no stored data. Closing the tab clears everything. This is
deliberate — it validates the core generation + evaluation loop before the full
platform (auth, DB, history) is built on top. Built to the *Digital PR Outreach
MVP Spec v1.0*.

---

## 2. Tech stack

- **Next.js 14** (App Router) + **Tailwind CSS** — single-page UI.
- **Next.js API routes** (serverless) — all AI calls run server-side so the API
  key never reaches the browser.
- **Google Gemini** via `@google/generative-ai`. Model default: **`gemini-2.5-flash`**
  (overridable with the `GEMINI_MODEL` env var).
- **papaparse** for CSV parsing.
- Deployed on **Vercel** (Hobby tier).

---

## 3. Where the code lives

- **Repo:** `Wiingy-US/reachout-automation`
- **Production branch:** `main` (Vercel deploys from here).
- The MVP was built on branch `claude/zealous-bardeen-YQD33`, merged to `main`
  via **PR #1** (merged). That branch still exists and could be deleted.

High-level structure (see `README.md` for the full file-by-file breakdown):

```
app/
  page.tsx                    # single-page orchestrator — all session state
  api/extract-pdf/route.ts    # PDF -> generation prompt + data facts
  api/generate/route.ts       # batch email generation
  api/quality-check/route.ts  # Layer 1 (deterministic) + Layer 2 (LLM judge)
components/                    # PdfUpload, PromptEditor, CsvUpload, PreviewTable, SummaryBar, ui
lib/
  gemini.ts                   # Gemini client + the 3 prompt designs
  rubric.ts                   # the 22 checks + tunable thresholds (RUBRIC_CONFIG)
  deterministicChecks.ts      # Layer 1 engine (no AI)
  quality.ts                  # verdict assembly + summary
  parse.ts                    # parses Gemini's delimited generation output
  csv.ts / exportCsv.ts       # CSV parse/validate + export
  htmlUtils.ts                # strip/word-count/bold/em-dash/unclosed-tag helpers
  types.ts                    # shared types
```

---

## 4. Current state — what works and what doesn't

### ✅ Done & verified
- Full MVP code is written, **typecheck passes** (`tsc --noEmit`), and the
  **production build passes** (`next build`).
- **Deployed live on Vercel** and the site loads. (Initial deploy failed twice —
  first a security advisory on Next.js, then a Vercel "no `public` output
  directory" / 404 error. Both resolved: the 404 was the **Framework Preset**
  not being set to **Next.js** + a stray Output Directory override. Fixed in the
  Vercel dashboard.)

### ⚠️ Open blocker — PDF upload fails for larger files
- **Symptom:** uploading a real PDF (e.g. "Most Musical Cities.pdf") shows the
  error: `Unexpected token 'R', "Request En"... is not valid JSON`.
- **Cause:** that text is the start of **"Request Entity Too Large"** — a
  plain-text error from Vercel. **Vercel serverless functions reject request
  bodies larger than ~4.5 MB.** The app currently sends the whole PDF through the
  API route, so Vercel blocks the request before our code runs. The client-side
  check allows up to 20 MB, so it doesn't catch this. Vercel **Pro does not raise
  this 4.5 MB body limit.**
- **Immediate workaround:** use a PDF under ~4 MB — that works today.
- **Permanent fix: NOT YET IMPLEMENTED. A decision is pending** (see section 6).

### ❓ Never tested against the live model
The end-to-end flow has not been run against a real Gemini key with real inputs,
so the model-dependent parts are unverified:
- That Gemini returns the delimited generation format the parser expects.
- That the judge returns clean JSON matching the schema.
- That native PDF extraction produces a sensible prompt + data facts.
The code is defensive (failed-row handling, JSON extraction, judge-error
fallback), but real model output usually needs a round of prompt tuning.

---

## 5. Deployment / configuration checklist

- **Framework Preset** in Vercel must be **Next.js** (this was the cause of the
  earlier 404). Build Command / Output Directory overrides must be **off**; Root
  Directory must be empty/`./`.
- **`GEMINI_API_KEY`** must be set in Vercel → Settings → Environment Variables
  (Production). Without it the page loads but every AI call returns 500. After
  adding it, **redeploy**.
- **Keep batch size at 10** on the Hobby tier — its 10-second function timeout
  will kill larger batches. 200 journalists run as 20 independent batches.

---

## 6. PENDING DECISION — how to handle PDFs over 4.5 MB

To support larger PDFs on Vercel, the file must not pass through the serverless
function body. Options on the table (user has not yet chosen):

1. **Extract PDF text in the browser** (e.g. pdf.js) and send only the text to
   Gemini. Removes the size limit, fast, works on Hobby. Downside: text-only — may
   miss statistics that live inside chart/graphic images. *(Recommended for MVP.)*
2. **Keep native PDF, cap at ~4 MB.** No architecture change — just lower the
   client limit and show a clear message; large reports must be compressed/split
   manually. Preserves Gemini's native PDF/vision understanding.
3. **Upload PDF to blob storage** (e.g. Vercel Blob) and have the server fetch it
   for Gemini. Handles big files natively but adds storage setup + cost.

Whichever is chosen, the client should also be fixed to **handle non-JSON error
responses gracefully** (show "file too large" instead of a JSON-parse error).

Any change lands on **`main`** (production), so it needs either direct-push
permission or a new PR.

---

## 7. Known assumptions to confirm

- **Quality rubric thresholds.** A few numeric limits aren't spelled out in the
  spec (it refers to an external SOP). SOP-aligned defaults live in one place —
  `RUBRIC_CONFIG` in `lib/rubric.ts`: subject ≤ 12 words, main ≤ 220 words,
  follow-up ≤ 100 words, ≤ 7 bolds, intro ≤ 5 sentences. **These should be
  confirmed against the real SOP** and are a one-line change each.

---

## 8. Out of MVP scope (planned for full platform)

Auth, database, campaign history/storage, suppression-list checking, follow-up
scheduling, generic emails 3 & 4, multi-campaign management, and AppScript direct
integration. See spec section 12 for the MVP → full-platform path.

---

## 9. Suggested next steps

1. Decide the **PDF-size approach** (section 6) and implement it.
2. Add **graceful non-JSON error handling** to the PDF upload component.
3. Run a **real end-to-end test** (small CSV + real PDF) against the live Gemini
   key and tune prompts/parser as needed.
4. Confirm **rubric thresholds** against the SOP.
5. (Optional) Delete the merged `claude/zealous-bardeen-YQD33` branch.
