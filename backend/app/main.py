import threading
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.models import Circular
from app.routes import circulars, fetch


def _resume_pending_analysis() -> None:
    """On startup, re-queue any circulars that were left unanalyzed (e.g. killed by hot-reload)."""
    db = SessionLocal()
    try:
        ids = [row.id for row in db.query(Circular.id).filter(Circular.analyzed_at.is_(None)).all()]
    finally:
        db.close()
    if ids:
        threading.Thread(
            target=fetch._analyze_in_background,
            args=(ids,),
            daemon=True,
        ).start()


def _scheduled_fetch() -> None:
    """Runs every day at 9 AM IST (03:30 UTC) — scrapes + analyzes new circulars."""
    print("[scheduler] daily fetch starting", flush=True)
    db = SessionLocal()
    try:
        from app.routes.fetch import fetch_now
        from fastapi import BackgroundTasks
        fetch_now(BackgroundTasks(), db)
    except Exception as e:
        print(f"[scheduler] fetch failed: {e}", flush=True)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _resume_pending_analysis()

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(_scheduled_fetch, CronTrigger(hour=3, minute=30))
    scheduler.start()
    print("[scheduler] started — daily fetch at 09:00 IST (03:30 UTC)", flush=True)

    yield

    scheduler.shutdown()


app = FastAPI(title="Glomo Regulatory Monitor", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(circulars.router)
app.include_router(fetch.router)


@app.get("/health")
def health():
    return {"status": "ok"}
