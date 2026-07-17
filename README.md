# White Hat

White Hat is a full-stack culinary hiring prototype for India focused on chefs, restaurants, hotels, caterers, and hospitality operators. This version is shaped for the Idea2Impact 2026 submission and extends the existing Node.js + Vercel deployment with AI-powered station-fit matching, chef-side profile drafting, and readiness coaching.

## Repo inspection summary

- Framework/runtime: plain Node.js HTTP server in [server.js](/D:/Projects/White%20Hat/server.js) with static assets in [public/](/D:/Projects/White%20Hat/public)
- Deployment shape: Vercel-ready via [api/index.js](/D:/Projects/White%20Hat/api/index.js) and [vercel.json](/D:/Projects/White%20Hat/vercel.json)
- Data layer today: JSON-backed data files in [data/](/D:/Projects/White%20Hat/data), plus optional Supabase storage for intake leads
- ORM/database config: none in the current repo
- Existing health endpoint: `GET /api/health`
- LLM key status found during implementation on July 17, 2026: no `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` was configured locally or in Vercel, so the code includes a graceful heuristic fallback path until a server-side key is added

## What changed

- Added an AI station-fit matching engine that ranks chefs from a natural-language kitchen brief
- Added AI match explanations for each chef result
- Added a chef-side AI profile builder from free text
- Added a kitchen-readiness score with actionable coaching suggestions
- Expanded chef records with stations, city history, and availability metadata
- Updated Supabase schema support so chef-side draft and readiness data can be stored with intake submissions

## AI methods used

### 1. Station-fit matching

- Primary path: OpenAI embeddings via `text-embedding-3-small` when `OPENAI_API_KEY` is available
- Fallback path: structured criteria extraction from an LLM, or deterministic heuristic parsing when no LLM key is present
- Matching output: ranked chefs with a `fitScore` from `0-100` plus a short explanation

### 2. Match explanations

- Primary path: server-side LLM explanation generation using either OpenAI or Anthropic
- Fallback path: rule-based explanation generation grounded in matched cuisines, stations, service types, and availability
- Client behavior: results are cached per query/filter combination in session storage so explanations are not regenerated every render

### 3. Chef profile builder

- Takes free-text kitchen experience and extracts:
  - cuisines
  - stations
  - years of experience
  - cities worked
  - service types
  - suggested availability type
- The draft is shown back to the chef for manual review before final submission

### 4. Kitchen-readiness score

- Scores profile completeness and coachability from structured profile data plus free text
- Returns a `0-100` readiness score and up to three concrete suggestions
- Displayed only in the chef-side intake review area, not in employer search results

## Core AI pipeline

White Hat now turns an employer's plain-language kitchen brief into structured hiring criteria, combines that with semantic similarity when OpenAI embeddings are available, scores each chef profile against the brief, and returns a ranked shortlist with explainable reasons. On the chef side, the system converts informal work-history text into structured profile fields, lets the chef edit the result before saving, and produces a readiness score with targeted coaching so workers without polished resumes can still build stronger, more discoverable profiles. If an LLM request fails or no key is configured, the app degrades to heuristic extraction and filter-aware ranking instead of breaking the page.

## Stack

- Node.js `22.x`
- Built-in `http`, `fs`, and `fetch`
- Static frontend with HTML, CSS, and vanilla JavaScript
- Vercel for deployment
- Optional Supabase for persistent lead storage
- Built-in `node:test` for API verification

No external runtime dependencies are required.

## Project structure

```text
.
|-- .github/
|-- api/
|   `-- index.js
|-- data/
|   |-- chefs.json
|   |-- leads.json
|   |-- masterclasses.json
|   |-- overview.json
|   `-- testimonials.json
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- supabase/
|   `-- leads.sql
|-- ai.js
|-- server.js
|-- server.test.js
|-- vercel.json
`-- README.md
```

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Test locally

```bash
npm test
```

## API endpoints

- `GET /api/health`
- `GET /api/overview`
- `GET /api/chefs`
- `GET /api/masterclasses`
- `GET /api/testimonials`
- `POST /api/chef-match`
- `POST /api/profile-draft`
- `POST /api/profile-readiness`
- `POST /api/leads`

## Required environment variables

### AI keys

- `OPENAI_API_KEY`
  Get this from the OpenAI API dashboard if you want embeddings plus OpenAI text generation.
- `ANTHROPIC_API_KEY`
  Get this from the Anthropic Console if you want Anthropic-powered text extraction, explanations, and coaching.

You can set either key. The server checks `OPENAI_API_KEY` first, then `ANTHROPIC_API_KEY`. If neither is present, the app stays functional with heuristic fallback, but the strongest model-backed behavior will not be active.

### Optional model overrides

- `OPENAI_TEXT_MODEL`
  Optional. Defaults to `gpt-5.6`.
- `ANTHROPIC_MODEL`
  Optional. Defaults to `claude-sonnet-4-6`.

### Persistent intake storage on Vercel

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE`
  Optional. Defaults to `leads`.

Run the schema in [supabase/leads.sql](/D:/Projects/White%20Hat/supabase/leads.sql) before turning on Supabase-backed storage.

## Deploy to Vercel

This repo is already structured for Vercel:

- static assets are served from `public/`
- `/api/*` routes run through the serverless handler
- Node.js is pinned in `package.json`

Typical flow:

1. Import the GitHub repository into Vercel.
2. Keep the project root at the repository root.
3. Add the environment variables above in the Vercel project settings.
4. Redeploy after saving env vars so the AI provider becomes active in production.

## Notes

- The `API health` endpoint and creator credit are preserved.
- Without Supabase, lead submissions on Vercel remain transient demo captures.
- Without `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, the AI UX still works through heuristic fallback, but hackathon judging will be stronger once a real server-side model key is configured in production.
