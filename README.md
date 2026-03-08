# Casino & Offer AI Researcher

An AI-powered research tool that discovers gaps in casino promotional offer coverage across NJ, MI, PA, and WV — built with a hybrid AI + traditional programming approach.

---

## Setup

### Prerequisites
- Node.js 18+
- At least one search provider API key:
  - [Exa](https://exa.ai) — sign up, get API key (recommended)
  - [Perplexity](https://docs.perplexity.ai) — sign up, get API key
  - [Tavily](https://tavily.com) + [Groq](https://console.groq.com) — both keys required

### Install & Run

```bash
cd casino-researcher
npm install
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```
# At least one provider required
EXA_API_KEY=your-exa-api-key-here
PERPLEXITY_API_KEY=your-perplexity-api-key-here
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=your-groq-api-key-here

CRON_SECRET=any-random-string
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a provider from the dropdown, and click **Run Research**. Progress streams live to the UI.

### Deployment

```bash
npx vercel
# Set environment variables in Vercel dashboard
# Cron job is configured automatically via vercel.json
```

---

## How It Works

The dashboard runs a 4-stage pipeline in 60-90 seconds:

```
┌──────────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  1. Discover     │───>│  2. Match   │───>│ 3. Compare       │───>│ 4. LLM Batch     │
│  (AI Search)     │    │  (Code)     │    │  (Code)          │    │  (AI — if needed) │
└──────────────────┘    └─────────────┘    └──────────────────┘    └──────────────────┘
  AI searches for        Fuzzy-match        Clear cases resolved    Only genuinely
  casinos + offers       against Xano DB    by comparing bonus      ambiguous cases
  per state              (Levenshtein)      amounts — no LLM        in a single batch
```

1. **Discovery** — AI searches for licensed casinos and current offers (2 searches per state, all 4 states staggered in parallel)
2. **Matching** — Fuzzy-matches discovered casinos against the Xano database to find gaps (normalization + Levenshtein distance)
3. **Comparison** — Resolves clear cases programmatically by comparing bonus amounts (>25% difference = clear verdict)
4. **LLM Batch** — Only genuinely ambiguous cases (close bonuses, complex wagering) go to an LLM in a single batched call

---

## Why Hybrid AI + Code (Not Pure LLM)

The common approach is to throw everything at an LLM — search, extract, compare, decide. That's expensive, slow, and often **less accurate** than code for the parts that don't need AI.

**The principle: AI for fuzzy problems, code for precise problems.**

| Task | Approach | Why |
|------|----------|-----|
| Web research | AI (Exa / Perplexity / Tavily) | Broad search — AI's strength |
| Data extraction | Native provider output | Exa/Perplexity return structured JSON directly — no LLM middleman |
| Name matching | Code (Levenshtein + normalization) | Deterministic, no hallucination risk |
| Offer comparison | Code (numeric) | "Is $1500 > $1000?" is an `if` statement, not a prompt. Code is more accurate. |
| Ambiguous cases | LLM (single batched call) | Complex wagering terms genuinely need reasoning |
| EV scoring | Code (formula) | bonus / wagering = always correct, always free |
| Cross-state grouping | Code (sort + group) | Pure data transformation — AI adds nothing here |

When we do use the LLM, we help it succeed: batch all ambiguous cases into one call with clean structured input. Less noise = better output. We're not just cutting costs — we're making the AI **more accurate** by only giving it problems it's actually good at.

### The Evolution

1. **v1 — Tavily + Gemini:** ~90 API calls. Every result through an LLM for extraction and analysis. Worked but slow and expensive.
2. **v2 — Exa + OpenRouter:** Better discovery, same LLM-heavy pattern. Still ~90 calls.
3. **v3 — Current:** Asked "what actually needs AI?" Only the search. Extraction → native structured output. Comparison → code. LLM → ambiguous cases only. **8 calls + 0-1 LLM. 91% reduction.**

| | Pure LLM | Hybrid |
|--|----------|--------|
| API calls | ~90 | 8 + 0-1 |
| Cost per run | $0.35–2.00 | $0.10 |
| Comparison accuracy | LLM hallucinates math | Deterministic |
| Speed | Minutes | 60-90s |

---

## Search Providers

Different providers find different things — the team can run multiple and compare for better total coverage. Not locked into one provider's blind spots.

| Provider | How It Works | API Calls | Cost |
|----------|-------------|-----------|------|
| **Exa Deep** (default) | Native structured JSON via `outputSchema` — no LLM extraction needed | 8 | ~$0.10 |
| **Perplexity Sonar** | Search + structured output in one call via `response_format` | 4 | ~$0.08 |
| **Tavily + Groq** | Tavily search + Groq LLM (Llama 3.3 70B) for extraction | 8 | ~$0.02 |

Providers without an API key are automatically disabled in the dropdown.

---

## Key Features

### Live Streaming Progress
A 60-90 second pipeline with just a spinner feels broken. Every stage streams to the UI in real-time — progress bar, log entries, state completions. If something fails, you see *where* it failed.

### Executive Summary with Per-State Breakdown
"5 missing casinos" isn't actionable. "3 in NJ, 2 in PA" is — the team can prioritize by market size. Designed to answer "what do I do next?" not "what happened?"

### Cross-State Offer Comparison Table
Same brand, different state, different promotion. If BetMGM offers $1500 in Michigan but we show $1000 for New Jersey, that's an immediate coverage gap. Pure code — grouping and highlighting data we already have.

### EV (Expected Value) Scoring
Bonus amount alone is misleading. A $1000 bonus with 50x wagering is worse than $500 with 10x. EV = bonus / wagering — it's a formula, always correct, always free. An LLM would sometimes get this math wrong.

### Source Citations on Everything
AI results without citations are just claims. Every finding links to its source — one click to verify. The system is a research assistant, not an oracle.

### Verdict Filters
The content team doesn't review 30+ comparisons. They filter to "Better Offer Found" and get an actionable shortlist of 3-5 items that need updating right now.

---

## Execution Model

- **On-demand**: Click "Run Research" in the dashboard
- **Scheduled**: Vercel cron runs daily at 6am UTC (`vercel.json`) — stays current automatically
- **API**: `POST /api/research/run` — supports `{ stream: true }` for streaming or plain JSON

---

## Project Structure

```
src/
├── app/                        # Next.js pages and API routes
│   ├── page.tsx                # Dashboard homepage
│   ├── report/[id]/            # Individual report view
│   └── api/
│       ├── research/run/       # POST — trigger pipeline (streaming + non-streaming)
│       ├── providers/          # GET — available search providers
│       └── cron/               # GET — scheduled daily run
├── components/
│   ├── ReportDashboard.tsx     # Main report layout with filters
│   ├── ExecutiveSummary.tsx    # Stats overview + per-state breakdown
│   ├── CrossStateTable.tsx     # Offers across states per casino
│   ├── MissingCasinosTable.tsx # Missing casinos grouped by state
│   ├── OfferComparisonCard.tsx # Side-by-side offer comparison with EV
│   └── RunButton.tsx           # Provider dropdown + run button + live logs
├── lib/
│   ├── search-provider.ts     # Unified provider interface (Exa, Perplexity, Tavily+Groq)
│   ├── research-pipeline.ts   # Pipeline orchestration with progress callbacks
│   ├── xano.ts                # Existing offers API client
│   ├── casino-matcher.ts      # Fuzzy name matching (normalize + Levenshtein)
│   └── store.ts               # Report storage (filesystem)
└── types/
    └── index.ts               # TypeScript interfaces + state config
```

---

## Technical Decisions

- **Exa schema constraint:** Exa Deep enforces max depth of 2 and max 10 properties. Instead of fighting it, I split into two focused queries (casinos + offers) running in parallel. API limitation → design advantage — targeted queries return better data than one overloaded query.
- **Provider abstraction:** One interface, three implementations. Adding a new provider is one file implementing one contract. The pipeline doesn't know or care which provider it's using.
- **Streaming:** Newline-delimited JSON from Next.js API route → React UI with live progress bar and terminal-style logs.
- **Rate limit handling:** Exa calls staggered with 600ms offsets between states. Tavily+Groq runs states sequentially. Retry with exponential backoff on 429/5xx.

---

## Trade-offs

- **Ephemeral storage** — Reports use filesystem (`/tmp` on Vercel), lost on cold starts. Speed-of-implementation tradeoff. Production → Postgres or Vercel KV.
- **Coverage gaps** — Some casinos return 0 offers. Broad AI search isn't exhaustive. A targeted second pass per casino would fill gaps.
- **Complex multi-part offers** — "$25 free + 100% match over 3 deposits" can't reduce to one number. That's what the LLM fallback handles, but it's not perfect.

## What I'd Add With More Time

- **Persistent storage** — Postgres or Vercel KV for reports that survive deployments
- **Historical tracking** — Diff between runs to catch expiring or changing promotions
- **Casino-specific second pass** — Re-search casinos that returned 0 offers
- **Slack/email alerts** — Notify when better offers are found
- **Multi-provider merge** — Run Exa + Perplexity simultaneously, combine for maximum coverage

---

> The goal wasn't the most AI-heavy system — it was the most effective one. AI for broad research and ambiguous reasoning. Code for math, matching, and formatting. 90 seconds, $0.10, actionable results — not because we used more AI, but because we used it where it matters.
