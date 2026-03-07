# Casino & Offer AI Researcher

An intelligent research tool that identifies gaps in casino promotional offer coverage across NJ, MI, PA, and WV. Uses AI-powered research to discover missing casinos and find better promotional offers compared to our existing database.

## How It Works

1. **Casino Discovery** - Queries state gaming commissions via Perplexity Sonar Pro to identify all licensed online casinos in each state
2. **Gap Analysis** - Compares discovered casinos against our existing database (Xano API) using fuzzy name matching
3. **Offer Research** - Researches current promotional offers for every casino (existing + newly discovered)
4. **AI Analysis** - Claude compares discovered offers against our current data, flagging genuinely superior offers
5. **Report** - Presents findings in a clean dashboard with citations and actionable insights

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PERPLEXITY_API_KEY` | Perplexity API key for web research |
| `ANTHROPIC_API_KEY` | Anthropic API key for offer analysis |
| `CRON_SECRET` | Secret token to authenticate scheduled runs |

## Running Research

**On-demand:** Click the "Run Research" button on the dashboard.

**Scheduled:** Runs daily at 6 AM UTC via Vercel Cron. Configure in `vercel.json`.

**API:** `POST /api/research/run`

## Project Structure

```
src/
  app/
    page.tsx                  # Dashboard - report view + run button
    api/research/run/route.ts # Main research orchestrator
    api/cron/route.ts         # Scheduled run handler
    report/[id]/page.tsx      # Historical report view
  lib/
    perplexity.ts             # Perplexity Sonar Pro client
    claude.ts                 # Anthropic SDK wrapper
    xano.ts                   # Existing offers API client
    research-pipeline.ts      # Orchestration logic
    casino-matcher.ts         # Fuzzy name matching
    store.ts                  # Report storage
  prompts/
    casino-discovery.ts       # Casino discovery prompts
    offer-research.ts         # Offer research prompts
    offer-analysis.ts         # Comparison/scoring prompts
  types/
    index.ts                  # TypeScript interfaces
  components/
    ReportDashboard.tsx       # Main report view
    MissingCasinosTable.tsx   # Missing casinos by state
    OfferComparisonCard.tsx   # Side-by-side offer comparison
    ExecutiveSummary.tsx      # Stats overview
    RunButton.tsx             # Trigger research on-demand
```

## Deployment

```bash
# Deploy to Vercel
npx vercel

# Set environment variables in Vercel dashboard
# Cron job is configured automatically via vercel.json
```

## Cost Per Run

| Service | Estimated Cost |
|---------|---------------|
| Perplexity Sonar Pro (~34 queries) | ~$0.14 - $1.50 |
| Claude Sonnet (~30 comparisons) | ~$0.20 |
| Vercel hosting + cron | Free |
| **Total** | **~$0.35 - $2.00** |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and technical decisions
- [AI Strategy](docs/AI-STRATEGY.md) - AI tools, models, and prompt engineering approach
- [Trade-offs & Future Work](docs/TRADE-OFFS.md) - Limitations, trade-offs, and improvement roadmap
