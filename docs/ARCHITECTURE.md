# Architecture

## System Overview

```
Vercel Cron (daily 6 AM UTC)  /  Dashboard button (on-demand)
    |
    v
API Route: POST /api/research/run
    |
    +--> [Parallel] Fetch Xano existing offers
    |                Discover casinos (4 states via Perplexity)
    |
    +--> Compare & find gaps (fuzzy name matching)
    |
    +--> Research offers per casino (Perplexity, batched)
    |
    +--> Analyze & compare offers (Claude, structured output)
    |
    +--> Store results (filesystem JSON)
    |
    v
Dashboard page renders report
```

## Stack Choices

### Next.js App Router on Vercel

The entire system lives in a single Next.js application:
- **API routes** serve as serverless functions for the research pipeline
- **React Server Components** render the dashboard with no client-side data fetching overhead
- **Vercel** provides free hosting, instant deployable URLs, and built-in cron scheduling
- No separate backend, no database server, no infrastructure to manage

This keeps the deployment surface to a single `vercel deploy` command and gives the reviewer a live URL immediately.

### Perplexity Sonar Pro for Research

Perplexity is purpose-built for real-time web research. Key advantages over alternatives:
- Returns **citations** with every response - we can show exactly where each finding came from
- Supports **domain filtering** - we target state gaming commission sites for authoritative casino lists
- Supports **recency filtering** - we get current promotional offers, not stale cached data
- Supports **JSON schema output** - structured data extraction without brittle parsing
- `sonar-pro` model provides double the citation density vs standard `sonar`

### Claude Sonnet for Analysis

Claude handles the analytical layer - comparing discovered offers against our existing data:
- **Structured output via tool_use** - reliable JSON responses for comparison verdicts
- Better at nuanced judgment ("is this offer genuinely better?") than search-focused models
- Separating analysis from research lets each model do what it's best at

### Filesystem Storage

Reports are stored as JSON files on disk (`data/reports/`). For a demo/trial project this is the right call:
- Zero configuration, works locally and on Vercel (ephemeral but sufficient for demo)
- Easy to inspect raw results during development
- Trivially upgradeable to Vercel KV or a database if this moves to production

## Key Design Decisions

### Dual AI Strategy

Rather than using one model for everything, the pipeline uses two specialized AI services:

| Stage | Service | Why |
|-------|---------|-----|
| Casino discovery | Perplexity Sonar Pro | Real-time web search with citations and domain filtering |
| Offer research | Perplexity Sonar Pro | Same - needs live web data with source URLs |
| Offer comparison | Claude Sonnet | Analytical reasoning, structured judgment, no web access needed |

This costs slightly more per run but produces significantly better results than using either model alone.

### Research Pipeline Stages

The pipeline runs sequentially with parallelism within each stage:

1. **Fetch + Discover (parallel)** - Xano API call and 4 state discovery queries run simultaneously
2. **Match** - Pure TypeScript fuzzy matching, no AI cost
3. **Research (batched parallel)** - Offer queries run 5 at a time to respect rate limits
4. **Analyze (sequential)** - Claude comparisons, one per casino to maintain context quality

### Fuzzy Name Matching

Casino names vary across sources ("BetMGM Casino NJ" vs "BetMGM" vs "BetMGM Online Casino"). The matcher uses:
- Name normalization (strip "casino", "online", state abbreviations, special characters)
- Substring containment check
- Levenshtein distance <= 2 for near-matches

This is intentionally simple. False negatives (failing to match) just mean a casino shows up as "missing" - the report reviewer catches these easily. False positives (incorrectly matching) are more dangerous and the conservative threshold prevents them.

### Researching ALL Casinos

The spec requires researching offers for **both existing and newly discovered** casinos. The pipeline:
- Researches offers for **matched casinos** (ones we already track) to find better alternatives
- Researches offers for **missing casinos** (ones we don't track) to identify new coverage opportunities
- Claude analysis runs on matched casinos to produce comparison verdicts

### Rate Limiting

Perplexity has a 50 RPM limit. The pipeline:
- Runs casino discovery queries in parallel (4 queries, well within limits)
- Batches offer research queries 5 at a time with delays between batches
- Tracks total API calls and estimated cost per run

## API Routes

### `POST /api/research/run`
Main orchestrator. Triggers the full research pipeline and returns the report ID. Long-running (1-3 minutes), uses streaming response to report progress.

### `GET /api/cron`
Vercel cron handler. Validates `CRON_SECRET` header, then calls the research pipeline. Configured in `vercel.json` for daily execution.

## Component Architecture

```
page.tsx (Dashboard)
  |
  +-- ExecutiveSummary       Stats: missing casinos, better offers found, states covered
  +-- RunButton              Triggers POST /api/research/run, shows progress
  +-- MissingCasinosTable    Grouped by state, with license source citations
  +-- OfferComparisonCard[]  Side-by-side current vs discovered, verdict badge
  +-- Footer                 Research cost, duration, timestamp, sources cited
```

All components are React Server Components by default. Only `RunButton` needs client-side interactivity.
