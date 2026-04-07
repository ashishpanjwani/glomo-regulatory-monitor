import threading
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _resume_pending_analysis()
    yield


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
