"""
Claude-powered circular analyzer.

For each circular we send:
  - System prompt: Glomopay's full business context + relevance scoring criteria
  - User message: circular title + raw content (truncated to 4000 chars)

Claude returns structured JSON with:
  summary, why_it_matters, relevance_score, action_items
"""

import json
import os
import time
from typing import Optional

import anthropic

SYSTEM_PROMPT = """You are a regulatory compliance analyst for Glomopay.

Glomopay context:
- IFSC-licensed payment institution operating in GIFT City, India
- Core business: facilitating outward remittances for Indian residents under the RBI's Liberalised Remittance Scheme (LRS), with an annual cap of USD 250,000 per individual
- Regulated by IFSCA (International Financial Services Centres Authority) under the IFSC regulatory framework
- Operations touch: RBI foreign exchange guidelines, FEMA 1999 provisions, FATF AML/CFT recommendations, SEBI circulars (for investment-linked remittances)
- Critical compliance areas: KYC/AML obligations, FATF screening of customers and counterparties, LRS limit monitoring, correspondent banking relationships, PAN-based transaction reporting to RBI CIMS, suspicious transaction reporting to FIU-IND

Your job is to read a regulatory circular and produce a structured analysis.

Relevance scoring definitions (apply strictly):
- HIGH: Directly impacts Glomopay's operations — e.g. changes to LRS limits/eligibility, IFSC licensing conditions, KYC/AML/CFT obligations, outward remittance rules, mandatory reporting to RBI/IFSCA/FIU-IND, FEMA amendments, FATF grey-listing of countries Glomopay serves
- MEDIUM: Indirectly relevant — e.g. affects Glomopay's partner banks or correspondents, changes customer eligibility criteria, introduces adjacent reporting requirements, impacts investment-linked remittance products, affects GIFT City ecosystem broadly
- LOW: Background regulatory context — e.g. domestic banking rules with no cross-border component, guidelines for sectors Glomopay doesn't operate in, clarifications that don't change existing obligations
- NOT_RELEVANT: No connection to Glomopay's regulated activities whatsoever

Respond ONLY with a valid JSON object in this exact format — no markdown, no commentary:
{
  "summary": "2-3 sentence plain English summary of what this circular says. No jargon. Explain it like you're briefing a non-lawyer colleague.",
  "why_it_matters": "2-3 sentences explaining specifically why this matters (or doesn't matter) to Glomopay. Reference our actual operations — LRS, IFSC licence, KYC, FATF, etc. Be concrete.",
  "relevance_score": "HIGH | MEDIUM | LOW | NOT_RELEVANT",
  "action_items": [
    {"action": "Specific action Glomopay's compliance team must take", "deadline": "Suggested timeframe e.g. 'Within 30 days' or 'By Q2 2025'"}
  ]
}

Rules:
- action_items must be [] for LOW and NOT_RELEVANT scores
- action_items should have 2-4 items for HIGH, 1-2 for MEDIUM
- Actions must be specific to Glomopay — not generic compliance advice
- Deadlines should be based on the circular's effective date if mentioned, otherwise suggest a reasonable timeframe"""


def analyze(title: str, raw_content: str) -> Optional[dict]:
    """
    Analyze a single circular. Retries up to 4 times on rate-limit errors
    with increasing wait (10s → 30s → 60s). Other errors fail immediately.
    Returns parsed dict or None on failure.
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Truncate content to keep cost and latency low; circulars front-load key obligations
    content_truncated = raw_content[:4000] if raw_content else title

    user_message = f"Circular title: {title}\n\nContent:\n{content_truncated}"

    for attempt in range(3):  # up to 3 attempts
        try:
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
                timeout=60.0,
            )
            raw = message.content[0].text.strip()
            # Strip accidental markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw)
        except anthropic.RateLimitError:
            wait = 30 * (attempt + 1)  # 30s, 60s, 90s
            print(f"[analyzer] rate limited, waiting {wait}s (attempt {attempt+1})", flush=True)
            time.sleep(wait)
        except json.JSONDecodeError as e:
            # Claude returned empty or non-JSON — transient, retry after short wait
            print(f"[analyzer] empty/invalid response for {title[:60]!r}, retrying (attempt {attempt+1}): {e}", flush=True)
            time.sleep(3)
        except Exception as e:
            print(f"[analyzer] failed for {title[:60]!r}: {type(e).__name__}: {e}", flush=True)
            return None  # timeout or API error — don't retry

    return None
