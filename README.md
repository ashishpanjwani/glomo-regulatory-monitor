# Glomo Regulatory Monitor

An AI-powered tool that monitors IFSCA and RBI regulatory circulars, scores their relevance to Glomopay's operations, and surfaces plain-English summaries and action items for the compliance team.

---

## Live Demo

[https://glomo-regulatory-monitor-ws6.vercel.app/](https://glomo-regulatory-monitor-ws6.vercel.app/)

---

## Running Locally

### Prerequisites

- Python 3.12+
- Node 18+
- A [Supabase](https://supabase.com) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com)

---

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Open `backend/.env` and fill in your values:

```
DATABASE_URL=your_supabase_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
```

- **DATABASE_URL** — from your Supabase project: Settings → Database → Connection Pooling → URI. Replace `[YOUR-PASSWORD]` with your DB password.
- **ANTHROPIC_API_KEY** — from [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.

```bash
# Start the server (tables are created automatically on first run)
uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

---

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Point the frontend at the local backend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Fetch Now** to pull the first batch of circulars.
