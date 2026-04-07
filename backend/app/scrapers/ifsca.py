"""
IFSCA scraper — https://ifsca.gov.in/Legal/Index/wF6kttc1JR8=

The circulars listing is powered by a JSON API endpoint:
  GET /Legal/GetLegalData?PageNumber=<n>&PageSize=50&SortCol=RowNum&SortType=desc&EncryptedId=wF6kttc1JR8=

Each record contains LegalId, Title, PublishDate (DD/MM/YYYY),
PhotoFileID and PhotoFileName (for building the PDF URL).
"""

import io
from datetime import datetime
from typing import Optional

import httpx
import pdfplumber

BASE_URL = "https://ifsca.gov.in"
API_URL = f"{BASE_URL}/Legal/GetLegalData"
ENCRYPTED_ID = "wF6kttc1JR8="

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; GlomoBot/1.0)",
    "Referer": f"{BASE_URL}/Legal/Index/{ENCRYPTED_ID}",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
}


def _fetch_pdf_text(url: str) -> Optional[str]:
    """Download a PDF from the given URL and extract its text. Returns None on failure."""
    try:
        print(f"[pdf] fetching: {url}", flush=True)
        resp = httpx.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        ct = resp.headers.get("content-type", "")
        print(f"[pdf] status={resp.status_code} content-type={ct} size={len(resp.content)}", flush=True)
        resp.raise_for_status()
        if "text/html" in ct:
            print("[pdf] got HTML instead of PDF — skipping", flush=True)
            return None
        with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
            pages_text = []
            for page in pdf.pages[:10]:  # cap at 10 pages
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            extracted = "\n".join(pages_text).strip()
            print(f"[pdf] extracted {len(extracted)} chars", flush=True)
            return extracted or None
    except Exception as e:
        print(f"[pdf] failed: {type(e).__name__}: {e}", flush=True)
        return None


def _parse_date(date_str: str) -> Optional[datetime]:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def _fetch_page(page: int) -> list[dict]:
    try:
        resp = httpx.get(
            API_URL,
            params={
                "PageNumber": page,
                "PageSize": 50,
                "SearchText": "",
                "SortCol": "RowNum",
                "SortType": "desc",
                "EncryptedId": ENCRYPTED_ID,
                "DateFrom": "",
                "DateTo": "",
                "AIlistType": 11,
            },
            headers=HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {}).get("LegalMasterModelList") or []
    except Exception:
        return []


def scrape() -> list[dict]:
    """
    Fetches the 2 most recent pages (up to 100 circulars) from the IFSCA
    legal circulars API, sorted newest-first.
    """
    results = []
    for page in range(1, 3):  # pages 1 and 2 → up to 100 circulars
        rows = _fetch_page(page)
        if not rows:
            break
        for row in rows:
            title = (row.get("Title") or "").strip()
            file_id = row.get("PhotoFileID", "")
            file_name = row.get("PhotoFileName", "")
            date_str = row.get("PublishDate", "")

            if not title or not file_id:
                continue

            url = (
                f"{BASE_URL}/CommonDirect/GetFileView"
                f"?id={file_id}&fileName={file_name}&TitleName=Legal"
            )

            results.append({
                "source": "IFSCA",
                "title": title,
                "url": url,
                "published_at": _parse_date(date_str),
                "raw_content": title,
            })

    return results
