# Digital PR Outreach — MVP

Single-session, stateless web tool that turns a generation prompt + data facts
summary into up to 600 personalised journalist pitch emails, runs a 29-check
quality rubric over them, and exports an AppScript-ready CSV. No login, no
database — when you close the tab, everything is gone.

> The core loop: **prompt + data facts in → personalised emails out → quality
> verdict out → CSV out.**

## The flow

1. **Campaign setup** — paste the `generation_prompt` and the `data_facts_summary`
   (both manual, entered by you).
2. **Upload journalist CSV** (≤ 600 rows) — required columns are validated.
3. **Pick batch size & generate** — batched Gemini calls with a live progress bar.
4. **Review** generated emails in the preview table (HTML rendered in sandboxed iframes).
5. **Run quality check** — Layer 1 deterministic checks server-side, then the
   Layer 2 LLM judge for rows that pass Layer 1.
6. **Download CSV** — all emails plus `quality_check_status` and `failed_checks`.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Get a Gemini API key at https://aistudio.google.com/app/apikey.

### Environment variables

| Variable         | Required | Default            | Notes                                   |
| ---------------- | -------- | ------------------ | --------------------------------------- |
| `GEMINI_API_KEY` | yes      | —                  | Server-side only, never sent to browser |
| `GEMINI_MODEL`   | no       | `gemini-2.5-flash` | Used for generation + quality check     |

## Scripts

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the dev server          |
| `npm run build`     | Production build              |
| `npm run typecheck` | `tsc --noEmit`                |
| `npm run lint`      | Next.js lint                  |

## Journalist CSV format

Required columns: `first_name`, `last_name`, `email`, `organisation`,
`designation`, `org_media_type`, `about_bio`.

Rows missing a **critical** field (`email`, `first_name`, `about_bio`) are flagged
on upload but not dropped.

## Architecture

```
app/
  page.tsx                  # single-page orchestrator (all session state)
  api/generate/route.ts     # batch email generation
  api/quality-check/route.ts# Layer 1 + Layer 2 per email
components/                  # StepIndicator, CsvUpload, PreviewTable, TokenCostPanel, …
lib/
  gemini.ts                 # Gemini client + generation/judge prompts
  parse.ts                  # delimited batch-output parser
  rubric.ts                 # the 29 checks + tunable thresholds
  deterministicChecks.ts    # Layer 1 engine (no AI)
  quality.ts                # verdict assembly + summary
  csv.ts / exportCsv.ts     # CSV parse/validate + export
  htmlUtils.ts              # strip/word-count/bold/em-dash/unclosed-tag helpers
```

All Gemini calls are server-side; the API key never reaches the browser.
Generation is batched (one API call per batch) so a timeout on one batch does not
kill the others.

## Quality rubric thresholds

A few numeric thresholds aren't spelled out verbatim in the MVP spec (it refers
to an external SOP). SOP-aligned defaults live in one place — `RUBRIC_CONFIG` in
`lib/rubric.ts` — and are easy to tune: subject ≤ 12 words, main ≤ 220 words,
follow-up ≤ 100 words, ≤ 7 bolds, intro ≤ 5 sentences.

## Deployment (Vercel)

Deploy to Vercel and set `GEMINI_API_KEY` in project env vars.

**Vercel Hobby has a 10-second function timeout.** A batch of 5–10 emails can
take 8–15s, so **keep batch size at 10 on Hobby** — 200 journalists run as 20
independent batches. Upgrade to Vercel Pro (300s timeout) before commercial use
or larger batches. The API routes declare `maxDuration = 60` for Pro; Hobby
silently caps at 10s.

## Out of MVP scope

Auth, database, campaign history, suppression lists, follow-up scheduling,
generic emails 3 & 4, and AppScript direct integration — see spec section 12 for
the path to the full platform.
