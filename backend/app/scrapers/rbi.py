"""
RBI scraper — uses the official RSS feed at:
https://rbi.org.in/notifications_rss.xml

Each RSS item contains:
  - title:       circular reference + subject
  - link:        URL to the detail page (HTML or PDF)
  - pubDate:     RFC 2822 date string
  - description: CDATA HTML block (often the full circular body)

After parsing the feed we fetch the detail page to extract the full
plain-text content for Claude analysis.
"""

import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import httpx
from bs4 import BeautifulSoup

RSS_URL = "https://rbi.org.in/notifications_rss.xml"
DETAIL_BASE = "https://www.rbi.org.in"


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()


def _fetch_detail_text(url: str) -> Optional[str]:
    """Fetch the circular detail page and return plain text."""
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; GlomoBot/1.0)"
        })
        if resp.status_code != 200:
            return None
        content_type = resp.headers.get("content-type", "")
        if "pdf" in content_type:
            # PDF — extract text with pdfplumber
            import io
            import pdfplumber
            with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
                pages = [p.extract_text() or "" for p in pdf.pages[:8]]
                return "\n".join(pages).strip()
        # HTML detail page
        return _clean_html(resp.text)
    except Exception:
        return None


def scrape() -> list[dict]:
    """
    Returns a list of dicts ready to be upserted into the circulars table.
    Each dict: {source, title, url, published_at, raw_content}
    """
    feed = feedparser.parse(RSS_URL)
    results = []

    for entry in feed.entries:
        title = _clean_html(entry.get("title", "")).strip()
        url = entry.get("link", "").strip()
        if not title or not url:
            continue

        # Normalise to absolute URL
        if url.startswith("/"):
            url = DETAIL_BASE + url

        # Parse publication date
        published_at: Optional[datetime] = None
        pub_str = entry.get("published", "")
        if pub_str:
            try:
                published_at = parsedate_to_datetime(pub_str).replace(tzinfo=None)
            except Exception:
                pass

        # Use CDATA description as quick content; fetch detail for richer text
        description_html = entry.get("summary", "") or entry.get("description", "")
        quick_text = _clean_html(description_html) if description_html else ""

        detail_text = _fetch_detail_text(url)
        raw_content = detail_text or quick_text or title

        results.append({
            "source": "RBI",
            "title": title,
            "url": url,
            "published_at": published_at,
            "raw_content": raw_content[:20000],  # cap storage size
        })

    return results
