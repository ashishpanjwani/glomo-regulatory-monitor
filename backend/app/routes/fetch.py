"""
POST /fetch  — scrapes + upserts synchronously (fast), then analyzes in background.

Returns real new_circulars count immediately so the UI can show
"Already up to date" or "+3 new".  Analysis runs in a background thread
pool so the response is never blocked by Claude API calls.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app import analyzer
from app.database import SessionLocal, get_db
from app.models import Circular
from app.scrapers import ifsca, rbi

router = APIRouter(tags=["fetch"])

ANALYSIS_CONCURRENCY = 5


def _analyze_in_background(circular_ids: list[str]) -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(Circular.id, Circular.title, Circular.raw_content)
            .filter(Circular.id.in_(circular_ids))
            .all()
        )
        tasks = [
            (row.id, row.title or "", row.raw_content or row.title or "")
            for row in rows
        ]

        def analyze_one(cid: str, title: str, content: str):
            print(f"[analyzer] starting: {title[:60]!r}", flush=True)
            result = analyzer.analyze(title, content)
            print(f"[analyzer] done: {title[:60]!r} → {result.get('relevance_score') if result else 'FAILED'}", flush=True)
            return cid, result

        with ThreadPoolExecutor(max_workers=ANALYSIS_CONCURRENCY) as pool:
            futures = {
                pool.submit(analyze_one, cid, title, content): cid
                for cid, title, content in tasks
            }
            for future in as_completed(futures):
                try:
                    cid, result = future.result()
                    c = db.query(Circular).filter(Circular.id == cid).first()
                    if c:
                        if result:
                            c.summary = result.get("summary")
                            c.why_it_matters = result.get("why_it_matters")
                            c.relevance_score = result.get("relevance_score")
                            c.action_items = result.get("action_items", [])
                        else:
                            print(f"[analyzer] marking cid={cid} as failed (analyzed_at set, no result)", flush=True)
                        # Always stamp analyzed_at — None result = failed, not pending
                        c.analyzed_at = datetime.utcnow()
                        db.commit()
                except Exception as e:
                    print(f"[analyzer] exception in future: {e}", flush=True)
                    db.rollback()
    finally:
        db.close()


@router.post("/fetch")
def fetch_now(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Scrape (fast — just HTTP + RSS, no Claude)
    scraped = rbi.scrape() + ifsca.scrape()

    # 2. Upsert — skip duplicates, count genuinely new ones
    new_count = 0
    for item in scraped:
        if db.query(Circular).filter(Circular.url == item["url"]).first():
            continue
        db.add(Circular(
            id=str(uuid4()),
            source=item["source"],
            title=item["title"],
            url=item["url"],
            published_at=item.get("published_at"),
            raw_content=item.get("raw_content"),
        ))
        new_count += 1
    db.commit()

    # 3. All unanalyzed → background
    unanalyzed_ids = [
        row.id for row in
        db.query(Circular.id).filter(Circular.analyzed_at.is_(None)).all()
    ]
    if unanalyzed_ids:
        background_tasks.add_task(_analyze_in_background, unanalyzed_ids)

    return {
        "status": "done",
        "new_circulars": new_count,
        "analyzed": len(unanalyzed_ids),
    }
