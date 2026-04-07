import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import analyzer
from app.database import get_db, SessionLocal
from app.models import Circular
from app.scrapers import ifsca as ifsca_scraper

router = APIRouter(prefix="/circulars", tags=["circulars"])


def _to_dict(c: Circular) -> dict:
    return {
        "id": c.id,
        "source": c.source,
        "title": c.title,
        "url": c.url,
        "published_at": c.published_at.isoformat() if c.published_at else None,
        "fetched_at": c.fetched_at.isoformat() if c.fetched_at else None,
        "summary": c.summary,
        "why_it_matters": c.why_it_matters,
        "relevance_score": c.relevance_score,
        "action_items": c.action_items or [],
        "is_reviewed": c.is_reviewed,
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        "analyzed_at": c.analyzed_at.isoformat() if c.analyzed_at else None,
    }


@router.get("")
def list_circulars(
    source: Optional[str] = Query(None, description="IFSCA | RBI"),
    relevance: Optional[str] = Query(None, description="HIGH | MEDIUM | LOW | NOT_RELEVANT"),
    reviewed: Optional[bool] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Circular)
    if source:
        q = q.filter(Circular.source == source.upper())
    if relevance:
        q = q.filter(Circular.relevance_score == relevance.upper())
    if reviewed is not None:
        q = q.filter(Circular.is_reviewed == reviewed)
    if date_from:
        q = q.filter(Circular.published_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Circular.published_at <= datetime.fromisoformat(date_to))

    total = q.count()
    items = (
        q.order_by(Circular.published_at.desc().nullslast(), Circular.fetched_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_to_dict(c) for c in items],
    }


@router.get("/{circular_id}")
def get_circular(circular_id: str, db: Session = Depends(get_db)):
    c = db.query(Circular).filter(Circular.id == circular_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circular not found")
    return _to_dict(c)


@router.post("/{circular_id}/rescrape")
def rescrape_circular(circular_id: str, db: Session = Depends(get_db)):
    """Re-fetch the PDF content for a circular and re-queue it for analysis."""
    c = db.query(Circular).filter(Circular.id == circular_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circular not found")

    # Re-fetch PDF text (IFSCA only; RBI circulars have content from RSS)
    pdf_text = ifsca_scraper._fetch_pdf_text(c.url) if c.source == "IFSCA" else None

    # Reset analysis fields
    c.summary = None
    c.why_it_matters = None
    c.relevance_score = None
    c.action_items = []

    if c.source == "IFSCA" and pdf_text is None:
        # PDF could not be fetched — mark as failed immediately, no point running analyzer
        c.analyzed_at = datetime.utcnow()
        c.raw_content = None
        db.commit()
        return {"status": "failed", "pdf_fetched": False}

    if pdf_text:
        c.raw_content = pdf_text

    c.analyzed_at = None  # re-queue for analysis
    db.commit()

    # Run analysis in background
    cid, title, content = c.id, c.title or "", c.raw_content or c.title or ""
    def _analyze():
        db2 = SessionLocal()
        try:
            result = analyzer.analyze(title, content)
            row = db2.query(Circular).filter(Circular.id == cid).first()
            if row:
                if result:
                    row.summary = result.get("summary")
                    row.why_it_matters = result.get("why_it_matters")
                    row.relevance_score = result.get("relevance_score")
                    row.action_items = result.get("action_items", [])
                row.analyzed_at = datetime.utcnow()  # stamp always — None result = failed
                db2.commit()
        except Exception:
            db2.rollback()
        finally:
            db2.close()

    rescrape_lock.active.add(circular_id)

    def _analyze_locked():
        try:
            _analyze()
        finally:
            rescrape_lock.active.discard(cid)

    threading.Thread(target=_analyze_locked, daemon=True).start()
    return {"status": "rescraping", "pdf_fetched": True}


@router.patch("/{circular_id}/review")
def toggle_review(circular_id: str, db: Session = Depends(get_db)):
    c = db.query(Circular).filter(Circular.id == circular_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Circular not found")
    c.is_reviewed = not c.is_reviewed
    c.reviewed_at = datetime.utcnow() if c.is_reviewed else None
    db.commit()
    db.refresh(c)
    return _to_dict(c)
