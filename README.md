# Casino & Offer AI Researcher

An AI-powered research tool that identifies gaps in casino promotional offer coverage across NJ, MI, PA, and WV. It discovers casinos we're not tracking, researches current promotions, and compares them against our existing database — all in a single click.

## Architectural Approach

The system runs a 4-stage pipeline, each stage using the best AI tool for the job:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. Discover │───>│  2. Match   │───>│ 3. Research  │───>│ 4. Analyze  │
│   (Exa AI)   │    │  (Fuzzy)    │    │  (Tavily)    │    │   (LLM)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
  Semantic search    Compare against    Search offers      Extract structured
  for licensed       Xano DB using      for every casino   data, compare vs
  casinos per state  normalization +    (existing + new)   current offers,
  from official      Levenshtein        with full page     produce verdicts
  sources            distance           content
```

**Stage 1 — Casino Discovery**: For each of the 4 states, Exa AI runs two semantic searches: one targeting official gaming commission sources, another targeting review aggregators. This dual approach catches casinos that might appear in one source but not the other. Exa returns full page text (not just snippets), so the LLM has complete data to work with.

**Stage 2 — Gap Analysis**: Discovered casinos are fuzzy-matched against the existing Xano database. The matcher normalizes names (strips "Casino", "Online", state codes), checks substring containment, and uses Levenshtein distance (threshold ≤ 2) to handle variations like "DraftKings" vs "Draft Kings".

**Stage 3 — Promotional Research**: Tavily searches for current offers for every casino — both ones we already track (to check for better deals) and newly discovered ones. Uses advanced search depth with raw content extraction for maximum data quality.

**Stage 4 — Offer Analysis**: The LLM extracts structured offer data (type, bonus amount, deposit, wagering requirements, promo codes) and compares each discovered offer against our current one. Each comparison gets a verdict: `discovered_better`, `existing_better`, `comparable`, `different_type`, or `no_data`.

## AI Tools Used and Why

| Role | Service | Why This Over Alternatives |
|---|---|---|
| Casino Discovery | [Exa AI](https://exa.ai) | Semantic search finds results by meaning, not keywords. Returns full page content (up to 5000 chars) vs snippets. Two-pronged search (official + review) maximizes coverage. Free: 1,000 searches/month. |
| Offer Research | [Tavily](https://tavily.com) | Built for LLM consumption — returns clean text with raw content extraction. Supports domain filtering to target specific casino websites. AI-generated answer field provides pre-synthesized summaries. Free: 1,000 searches/month. |
| Extraction & Analysis | [OpenRouter](https://openrouter.ai) | Access to 27 free models. Default: Llama 3.3 70B (GPT-4 level). Configurable via env var — swap models without code changes. JSON response format ensures structured output. Free: 200 requests/day. |

Each service was chosen for a specific strength rather than using one tool for everything. The entire stack runs on free tiers — zero cost per run.

## Key Features

- **Cross-State Offer Comparison Table** — See the same casino's best offer across NJ/MI/PA/WV side-by-side, with the best offer highlighted. Lets you spot which states have better deals at a glance.
- **EV (Expected Value) Scoring** — Bonus amount alone is misleading. A $1,000 bonus with 50x wagering is worse than $500 with 10x. The EV score (bonus / wagering multiplier) surfaces truly profitable offers.
- **State & Verdict Filters** — Drill into specific states or verdict types (e.g., show only "Better Offer Found").
- **Per-State Breakdown** — Executive summary shows missing casinos and better offers broken down per state, not just totals.
- **Source Citations** — Every finding links back to the source URL for human verification.
- **Color-Coded Verdicts** — Comparisons are sorted by priority (better offers first) and color-coded for quick scanning.

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
│   ├── exa.ts               # Exa AI search client (discovery)
│   ├── tavily.ts            # Tavily search client (offer research)
│   ├── llm.ts               # OpenRouter LLM client (extraction + analysis)
│   ├── xano.ts              # Existing offers API client
│   ├── casino-matcher.ts    # Fuzzy name matching (normalize + Levenshtein)
│   ├── research-pipeline.ts # Pipeline orchestration
│   └── store.ts             # Report storage (filesystem)
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

- **Storage is ephemeral on Vercel** — Reports are saved to filesystem (`/tmp` on serverless). For production, a database or S3 would provide persistence across deployments.
- **AI accuracy is not 100%** — All findings include source URLs for human verification. The system surfaces candidates for review, not ground truth. This is by design — AI does the heavy research, humans make the final call.
- **Free tier rate limits** — OpenRouter: 200 requests/day (~3 full runs). Exa and Tavily: 1,000 requests/month each. For higher throughput, paid tiers are available (and the LLM model is swappable via env var).
- **Single-run snapshot** — Each run produces an independent report. There's no diffing between runs to detect what changed since last time.

## Challenges & How I Solved Them

- **Gemini API quota exhaustion** — Initially used Google Gemini free tier for LLM extraction, but daily quotas were too restrictive and unreliable. Switched to OpenRouter which provides access to multiple free models with separate quotas.
- **Search snippets too short** — Standard search APIs return ~200 char snippets, missing most casino names from long regulatory lists. Solved by using Exa's full page content extraction (up to 5000 chars) and Tavily's `include_raw_content` option.
- **Casino name variations** — The same casino appears under different names ("BetMGM" vs "Bet MGM", "DraftKings Casino" vs "Draft Kings"). Built a multi-strategy matcher: normalization → substring check → Levenshtein distance.
- **Serverless constraints** — Vercel's serverless functions have read-only filesystems and short timeouts. Used `/tmp` for storage and `maxDuration = 300` for the pipeline route.

## What I'd Improve With More Time

- **Persistent storage** — Database or S3 instead of ephemeral filesystem
- **Streaming progress** — SSE/WebSocket updates to the UI during pipeline execution
- **Historical tracking** — Diff between runs to detect when offers change, improve, or expire
- **Alerting** — Email/Slack notifications when better offers are found
- **Confidence calibration** — Human feedback loop to improve LLM accuracy over time
- **Perplexity integration** — For even deeper discovery quality (searches + reasons in one call, reads full pages internally)
