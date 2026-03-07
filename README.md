# Casino & Offer AI Researcher

An AI-powered research tool that identifies gaps in casino promotional offer coverage across NJ, MI, PA, and WV. It discovers casinos we're not tracking, researches current promotions, and compares them against our existing database.

## How It Works

The system runs a 4-stage pipeline:

1. **Discover** — Exa AI performs semantic searches for licensed online casinos per state, targeting gaming commission sources and review aggregators
2. **Match** — Fuzzy matching (normalization + Levenshtein distance) compares discovered casinos against the Xano database to find missing ones
3. **Research** — Tavily searches for current promotional offers for every casino (both existing and newly discovered)
4. **Analyze** — An LLM (via OpenRouter) extracts structured offer data and compares discovered offers against our current ones, producing a verdict for each

Results are displayed in a dashboard with:
- Executive summary with per-state breakdown
- Cross-state offer comparison table
- Missing casinos grouped by state
- Offer comparison cards with EV scoring
- Filters by state and verdict

## AI Stack

| Role | Service | Why |
|---|---|---|
| Casino Discovery | [Exa AI](https://exa.ai) | Semantic search returns full page content from regulatory sources — finds more casinos than keyword search |
| Offer Research | [Tavily](https://tavily.com) | Advanced search with raw content extraction, good for site-specific offer lookups |
| Extraction & Analysis | [OpenRouter](https://openrouter.ai) (Llama 3.3 70B) | Free LLM for structured JSON extraction and offer comparison |

All three services are free tier — zero cost per run.

## Setup

### Prerequisites
- Node.js 18+
- API keys (all free, no credit card required):
  - [Exa AI](https://exa.ai) — sign up, get API key
  - [Tavily](https://tavily.com) — sign up, get API key
  - [OpenRouter](https://openrouter.ai) — sign in with GitHub, create API key

### Install

```bash
cd casino-researcher
npm install
cp .env.example .env
```

Edit `.env` with your API keys:

```
TAVILY_API_KEY=tvly-your-key-here
EXA_API_KEY=your-exa-key-here
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
CRON_SECRET=any-random-string
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Run Research**.

## Execution Model

- **On-demand**: Click "Run Research" in the dashboard
- **Scheduled**: Vercel cron runs daily at 6am UTC (configured in `vercel.json`)
- **API**: `POST /api/research/run`

## Project Structure

```
src/
├── app/                      # Next.js pages and API routes
│   ├── page.tsx              # Dashboard homepage
│   ├── report/[id]/          # Individual report view
│   └── api/
│       ├── research/run/     # POST — trigger pipeline
│       └── cron/             # GET — scheduled daily run
├── components/
│   ├── ReportDashboard.tsx   # Main report layout with filters
│   ├── ExecutiveSummary.tsx  # Stats overview + per-state breakdown
│   ├── CrossStateTable.tsx   # Offers across states per casino
│   ├── MissingCasinosTable.tsx # Missing casinos grouped by state
│   ├── OfferComparisonCard.tsx # Side-by-side offer comparison with EV
│   └── RunButton.tsx         # Trigger button with status
├── lib/
│   ├── exa.ts               # Exa AI search client
│   ├── tavily.ts            # Tavily search client
│   ├── llm.ts               # OpenRouter LLM client
│   ├── xano.ts              # Xano API client
│   ├── casino-matcher.ts    # Fuzzy name matching
│   ├── research-pipeline.ts # Pipeline orchestration
│   └── store.ts             # Report storage
├── prompts/
│   ├── casino-discovery.ts  # Discovery prompts + JSON schema
│   └── offer-research.ts    # Offer research prompts + JSON schema
└── types/
    └── index.ts             # TypeScript interfaces + state config
```

## Deployment

```bash
npx vercel
# Set environment variables in Vercel dashboard
# Cron job is configured automatically via vercel.json
```

## Trade-offs & Limitations

- **Storage is ephemeral on Vercel** — reports are saved to filesystem (`/tmp` on serverless). For production, use a database or S3.
- **AI accuracy varies** — all findings include source URLs for human verification. The system surfaces candidates, not ground truth.
- **Free tier rate limits** — OpenRouter: 200 requests/day (~3 full runs). Exa and Tavily: 1,000 requests/month each.
- **LLM model is configurable** — change `OPENROUTER_MODEL` in `.env` to try different models.

## What I'd Improve With More Time

- Persistent storage (database or S3 instead of filesystem)
- Streaming progress updates to the UI via SSE
- Historical trend tracking (offer changes over time)
- Email/Slack alerts when better offers are found
- Confidence calibration with human feedback loop
