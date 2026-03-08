# Casino & Offer AI Researcher

An AI-powered research tool that identifies gaps in casino promotional offer coverage across NJ, MI, PA, and WV. It discovers casinos we're not tracking, researches current promotions, and compares them against our existing database — all in a single click with live streaming progress.

## Architectural Approach

The system runs a 4-stage pipeline with switchable search providers and smart comparison logic:

```
┌──────────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  1. Discover     │───>│  2. Match   │───>│ 3. Compare       │───>│ 4. LLM Batch     │
│  (Search Provider)│    │  (Fuzzy)    │    │  (Programmatic)  │    │  (Ambiguous only) │
└──────────────────┘    └─────────────┘    └──────────────────┘    └──────────────────┘
  2 parallel searches    Compare against    Clear cases resolved    Only genuinely
  per state (casinos     Xano DB using      by comparing bonus      ambiguous cases
  + offers) via Exa,     normalization +    amounts directly —      go to LLM in a
  Perplexity, or Tavily  Levenshtein        no LLM needed           single batched call
```

**Stage 1 — Discovery**: For each of the 4 states, the selected search provider finds licensed casinos and their current promotional offers. Exa Deep and Perplexity use native structured output (no separate LLM needed). Tavily uses Groq for extraction.

**Stage 2 — Gap Analysis**: Discovered casinos are fuzzy-matched against the existing Xano database. The matcher normalizes names (strips "Casino", "Online", state codes), checks substring containment, and uses Levenshtein distance (threshold ≤ 2) to handle variations like "DraftKings" vs "Draft Kings".

**Stage 3 — Programmatic Comparison**: Most offer comparisons are resolved without an LLM by comparing bonus amounts directly. Cases with >25% difference, type mismatches, or missing data get clear verdicts immediately.

**Stage 4 — LLM Batch (if needed)**: Only genuinely ambiguous cases (close bonus amounts, complex wagering terms) go to an LLM — all in a single batched call, not one per casino. Typically 0-1 LLM calls per full run.

## Search Providers

The dashboard includes a provider dropdown to switch between search backends:

| Provider | How It Works | API Calls | Cost |
|----------|-------------|-----------|------|
| **Exa Deep** (default) | 2 parallel searches per state with `outputSchema` for native structured JSON. No separate LLM needed. | 8 | ~$0.10 |
| **Perplexity Sonar** | 1 search per state with `response_format: json_schema`. Search + structured output in one call. | 4 | ~$0.08 |
| **Tavily + Groq** | Tavily search + Groq LLM (Llama 3.3 70B) for extraction. States run sequentially to respect rate limits. | 8 | ~$0.02 |

Providers without an API key are automatically disabled in the dropdown.

## Key Features

- **Live Streaming Progress** — Real-time progress bar and terminal-style log panel in the UI showing each pipeline stage as it runs
- **Switchable Providers** — Dropdown to switch between Exa Deep, Perplexity Sonar, and Tavily + Groq
- **Smart Comparison** — Programmatic first (compare numbers), LLM only for ambiguous cases (0-1 calls total)
- **Cross-State Offer Comparison Table** — See the same casino's best offer across NJ/MI/PA/WV side-by-side, with the best offer highlighted
- **EV (Expected Value) Scoring** — Bonus amount alone is misleading. A $1,000 bonus with 50x wagering is worse than $500 with 10x. The EV score (bonus / wagering multiplier) surfaces truly profitable offers
- **State & Verdict Filters** — Drill into specific states or verdict types (e.g., show only "Better Offer Found")
- **Per-State Breakdown** — Executive summary shows missing casinos and better offers per state
- **Source Citations** — Every finding links back to the source URL for human verification

## Setup

### Prerequisites
- Node.js 18+
- At least one search provider API key:
  - [Exa](https://exa.ai) — sign up, get API key (recommended)
  - [Perplexity](https://docs.perplexity.ai) — sign up, get API key
  - [Tavily](https://tavily.com) + [Groq](https://console.groq.com) — both keys required

### Install

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

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a provider from the dropdown, and click **Run Research**. Progress streams live to the UI.

## Execution Model

- **On-demand**: Click "Run Research" in the dashboard (with live streaming progress)
- **Scheduled**: Vercel cron runs daily at 6am UTC (configured in `vercel.json`)
- **API**: `POST /api/research/run` — supports `{ stream: true }` for streaming or plain JSON response

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

## Efficiency

| Metric | Old Pipeline | Current Pipeline |
|--------|-------------|-----------------|
| API calls | ~90 across 3 providers | ~8 Exa + 0-1 LLM |
| Separate LLM extraction | Every result | None (native structured output) |
| Offer comparison | Every casino via LLM | Programmatic first, LLM batch for ambiguous only |
| Cost per run | ~$0.35-2.00 | ~$0.10 (Exa Deep) |

## Deployment

```bash
npx vercel
# Set environment variables in Vercel dashboard
# Cron job is configured automatically via vercel.json
```

## Trade-offs & Limitations

- **Storage is ephemeral on Vercel** — Reports are saved to filesystem (`/tmp` on serverless). For production, a database or S3 would provide persistence across deployments.
- **AI accuracy is not 100%** — All findings include source URLs for human verification. The system surfaces candidates for review, not ground truth.
- **Exa's offer coverage varies by state** — Some casinos return 0 offers. A second pass targeting those specific casinos could fill gaps.
- **Programmatic comparison can't evaluate complex multi-part offers** — "25 free + 100% match up to $1000 over 3 deposits" requires LLM analysis (handled by the ambiguous case batch).

## What I'd Improve With More Time

- **Persistent storage** — Vercel KV or Postgres instead of ephemeral filesystem
- **Historical tracking** — Diff between runs to detect when offers change or expire
- **Casino-specific second pass** — Re-search casinos with missing offers for better coverage
- **Email/Slack alerts** — Notifications when better offers are found
- **Side-by-side provider comparison** — Run Exa + Perplexity simultaneously, merge results
