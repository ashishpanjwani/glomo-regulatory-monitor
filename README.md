# Glomo Regulatory Monitor

An AI-powered prototype that monitors IFSCA and RBI regulatory publications, summarises them in plain English, scores their relevance to Glomopay's operations, and surfaces specific action items for the compliance team.

---

## 1. Problem Scoping

### Who is the user?

The compliance officer (or small compliance team) at Glomopay — an IFSC-licensed payment institution in GIFT City processing outward remittances under LRS. They are regulatory generalists, not lawyers. They need to stay current across IFSCA, RBI, FEMA, and FATF — but they don't have time to read every circular cover to cover. Their actual job is to assess impact and decide what to act on.

**Current workflow:**
1. Manually visit ifsca.gov.in, rbi.org.in, and 3–4 other sites each week
2. Download PDFs of new circulars
3. Read them to determine if they're relevant
4. Flag anything that might affect product, operations, or risk frameworks
5. Write up action items for the team
6. Repeat, sometimes daily when news breaks

### Highest-leverage pain

Not discovery — it's **triage time**. The real cost isn't visiting the websites; it's reading documents that turn out to be irrelevant. A compliance officer shouldn't spend 20 minutes reading a circular about domestic bank reserve ratios to determine it doesn't apply to them. The tool should make that determination instantly so they can focus only on what matters.

### What I'm not building

- **Cross-circular Q&A** — requires a vector store and embedding pipeline. High infra cost for a feature that's secondary to the core monitoring loop. Worth building in v2 once the feed itself is trusted.
- **Manual document upload** — valuable, but doesn't demonstrate the core monitoring value. Can be layered on without architectural changes.
- **Email/Slack alerts** — useful for production, unnecessary for demonstrating the prototype's core loop.
- **User authentication** — single-team tool; auth adds complexity without changing the core product decision.

### Assumptions I'd validate before production

1. **IFSCA's AJAX endpoint structure** — the live scraper attempts a DataTables server-side POST. I've seeded real fallback data for the prototype; production would use Playwright for guaranteed reliability.
2. **4000-char truncation is sufficient** — I'm betting that key obligations appear early in circulars. If the compliance team finds Claude missing tail-end provisions, I'd increase the limit or chunk-and-summarise.
3. **The compliance team wants actionable specificity over exhaustiveness** — I've tuned the prompt for Glomopay-specific actions rather than generic compliance advice. This needs user validation.
4. **Relevance scoring accuracy** — the LLM-based scoring needs calibration against real circulars the team has already triaged. What the model calls LOW, the team might consider MEDIUM.

---

## 2. Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Backend | Python FastAPI on Fly.io | Python is strongest for scraping + data pipeline work; FastAPI is fast to build with |
| Frontend | Next.js + Tailwind on Vercel | React (matches Glomo's stack); Vercel deploy is zero-config |
| Database | Supabase (Postgres) | Free managed DB; accessible from both Fly.io and Vercel; JSONB for action_items |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | Best in class for structured JSON output and domain reasoning |
| Scraping | feedparser (RBI RSS) + httpx/BS4 (IFSCA) | RSS is the most reliable source; BS4 for HTML fallback |

---

## 3. Running Locally

### Prerequisites
- Python 3.12+
- Node 18+
- A [Supabase](https://supabase.com) project (free tier)
- An [Anthropic API key](https://console.anthropic.com)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp ../.env.example .env
# Edit .env: set DATABASE_URL and ANTHROPIC_API_KEY

# Run (tables are created automatically on startup)
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the Swagger UI.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variable
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run dev server
npm run dev
```

Open `http://localhost:3000`. Click **Fetch Now** to pull the first batch of circulars.

---

## 4. Deploying to Production

### Backend → Fly.io

```bash
cd backend

# Install flyctl: https://fly.io/docs/getting-started/installing-flyctl/
fly auth login
fly launch          # creates the app; accept defaults
fly secrets set ANTHROPIC_API_KEY=sk-ant-... DATABASE_URL=postgresql://...
fly deploy
```

### Frontend → Vercel

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel
vercel

# When prompted, set environment variable:
# NEXT_PUBLIC_API_URL = https://your-app.fly.dev
```

Or connect the GitHub repo to Vercel directly and set `NEXT_PUBLIC_API_URL` in the Vercel dashboard.

### Supabase setup

The tables are created automatically when the FastAPI app starts (`Base.metadata.create_all`). No manual SQL needed — just point `DATABASE_URL` at your Supabase project's connection string (Settings → Database → Connection string → URI).

---

## 5. Design Decisions

### Sourcing regulatory updates

**RBI**: Uses the official RSS feed (`rbi.org.in/notifications_rss.xml`). The feed provides structured XML with title, date, link, and often the full circular body in a CDATA block. This is the most stable approach — it survives HTML redesigns and doesn't require JavaScript execution.

**IFSCA**: Their site uses JavaScript-rendered DataTables. Strategy 1 is to intercept the DataTables AJAX endpoint directly; Strategy 2 (automatic fallback) is seeded real IFSCA circulars for demo reliability. Production should use Playwright for guaranteed rendering.

**Alternatives considered**: Full HTML scraping with Playwright for both. Rejected because RBI's RSS is already reliable and adding Playwright just for RBI would be over-engineering.

### Relevance scoring

Using Claude with a carefully structured system prompt rather than keyword matching. Keyword matching would miss nuanced implications (e.g. a FATF grey-listing affects Glomopay's correspondent relationships even if the word "LRS" never appears). The system prompt injects Glomopay's full business context and defines crisp scoring criteria so the model reasons about actual impact, not surface-level matches.

**What I'd change with more time**: Calibrate the scoring with the compliance team on 20–30 historical circulars they've already triaged. Use their labels to tune the prompt's scoring thresholds.

### Prompt structure

The system prompt leads with Glomopay's business context (IFSC licence, LRS, FATF obligations), then defines relevance scoring criteria, then specifies exact JSON output format. This ordering matters — grounding in business context before scoring definitions gives the model the frame it needs to reason about relevance correctly, not just pattern-match on keywords.

Content is truncated to 4,000 characters before passing to Claude. Circulars front-load their key obligations; the tail is usually appendices and definitions. This keeps cost and latency low while capturing the material content.

### Citation accuracy

In this prototype, citations are implicit — every analysis card links to the original circular URL. For the Q&A features (not built here), citation accuracy would require chunk-level embedding with source metadata so the model can cite specific sections, not just documents.

### Avoiding false positives in relevance scoring

Two mechanisms:
1. The system prompt defines scoring tiers with concrete examples tied to Glomopay's actual operations — not generic financial institution criteria.
2. For LOW and NOT_RELEVANT items, the "Why it matters" field is still surfaced, so a compliance officer can quickly sanity-check the model's reasoning without having to trust it blindly.

### Productionising the monitoring loop

Current state: manual "Fetch Now" trigger. For production:
- Fly.io cron machine runs `POST /fetch` every 6 hours
- Move Claude analysis to an async background task queue (ARQ or Celery) so the `/fetch` endpoint returns immediately with a job ID
- Add webhook/email notification for new HIGH-relevance circulars

---

## 6. What's Next

### 3 biggest risks to resolve before production

1. **IFSCA scraping reliability** — the seed fallback works for a demo, but live monitoring requires either a stable AJAX endpoint or a Playwright-based headless scraper. This needs a one-time engineering investment and ongoing monitoring.

2. **Relevance scoring calibration** — the LLM's scoring hasn't been validated against the compliance team's actual triage history. A systematic review of 30 past circulars (where the team already knows the answer) would tell us whether the model is over/under-sensitive at each tier.

3. **Circular content extraction for PDFs** — many circulars are PDF-linked. The current implementation uses `pdfplumber` for text extraction, which works for text-based PDFs but fails on scanned images. A production build needs OCR (e.g. AWS Textract) for older documents.

### Metrics to measure whether this is working

1. **Triage time reduction** — time from circular publication to compliance team awareness and action decision. Baseline: measure current manual time; target: < 5 minutes for any HIGH circular.
2. **False negative rate** — circulars marked LOW/NOT_RELEVANT by the model that the team later identifies as requiring action. This is the risk metric; even one miss is costly.
3. **Review completion rate** — % of HIGH and MEDIUM circulars marked as reviewed within 48 hours of publication. This measures whether the tool is actually integrated into the team's workflow.

### 3-month roadmap

**Month 1 — Make the core loop production-grade**
- Playwright-based IFSCA scraper (replace seed fallback)
- Async analysis pipeline (decouple fetch from Claude calls)
- Fly.io cron job for scheduled monitoring
- Email/Slack notification for new HIGH circulars

**Month 2 — Expand coverage and validate AI quality**
- Add SEBI and FATF as monitored sources
- Calibration session with compliance team: label 30 historical circulars, tune the prompt
- PDF OCR pipeline for scanned documents
- Compliance team feedback loop: thumbs up/down on AI analysis quality

**Month 3 — Cross-circular intelligence**
- Embed and store circular chunks in a vector store (pgvector on Supabase)
- Cross-circular Q&A: "What are our current AML obligations across all stored circulars?"
- Manual upload for audit reports and internal compliance docs
- Obligation tracker: a derived view showing open compliance obligations with owners and due dates
