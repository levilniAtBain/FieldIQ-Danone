#!/usr/bin/env python3
"""
fetch_product_images.py
=======================
For each product in the catalog CSV:
  1. Search Google for the product on the brand's official site
  2. Follow the first result to the real product page
  3. Extract the main product image URL
  4. Write updated CSV + JSON report

Usage:
    pip3 install requests beautifulsoup4 lxml
    python3 fetch_product_images.py

Input:  loreal_product_catalog.csv  (same directory)
Output: loreal_product_catalog_updated.csv
        fetch_report.json
"""

import csv
import json
import time
import random
import logging
import re
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, quote_plus

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

INPUT_CSV    = Path(__file__).parent / "loreal_product_catalog.csv"
OUTPUT_CSV   = Path(__file__).parent / "loreal_product_catalog_updated.csv"
REPORT_JSON  = Path(__file__).parent / "fetch_report.json"

MIN_DELAY       = 2.0
MAX_DELAY       = 4.5
REQUEST_TIMEOUT = 15
MAX_RETRIES     = 2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Brand config
# ---------------------------------------------------------------------------

BRAND_DOMAINS = {
    "vichy":          "vichy.fr",
    "cerave":         "cerave.fr",
    "la_roche_posay": "laroche-posay.fr",
    "skinceuticals":  "skinceuticals.fr",
    "skinbetter":     "skinbetterscience.com",
    "mixa":           "mixa.fr",
    "nyx":            "nyxcosmetics.fr",
    "biotherm":       "biotherm.fr",
    "medik8":         "medik8.fr",
}

BRAND_IMG_SELECTORS = {
    "vichy":          ["img.product__image", "picture img", "img[data-zoom-image]"],
    "cerave":         ["img.product__media-img", "div.product__media img", "img[data-zoom-image]"],
    "la_roche_posay": ["img.product-detail__media-img", "picture img", "img.product__image"],
    "skinceuticals":  ["img.product-main-image", "div.product-image-container img", "img[data-zoom-image]"],
    "skinbetter":     ["img.product__media-img", "img[data-product-image]"],
    "mixa":           ["div.product-visual img", "img.product__image", "img[itemprop='image']"],
    "nyx":            ["img.product-primary-image", "div.product__media img"],
    "biotherm":       ["img.product-main-image", "div.product-gallery img", "img.product__image"],
    "medik8":         ["img.product__image", "div.product__media-item img"],
}

# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "DNT": "1",
    })
    return s

# ---------------------------------------------------------------------------
# Step 1 — Google search to find the real product URL
# ---------------------------------------------------------------------------

def find_product_url(session: requests.Session, name: str, brand: str) -> Optional[str]:
    domain = BRAND_DOMAINS.get(brand)
    if not domain:
        return None

    # Strip volume/weight info for a cleaner search query
    clean = re.sub(r"\b\d+\s*(ml|g|cl|x\d+ml)\b", "", name, flags=re.IGNORECASE).strip()
    query = f'site:{domain} "{clean}"'
    url   = f"https://www.google.com/search?q={quote_plus(query)}&hl=fr&num=5"
    log.debug("  Search: %s", query)

    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        log.warning("  Google search error: %s", exc)
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/url?q="):
            href = href[7:].split("&")[0]
        if domain in href and href.startswith("http"):
            return href
    return None

# ---------------------------------------------------------------------------
# Step 2 — Scrape image from product page
# ---------------------------------------------------------------------------

def abs_url(url: str, base: str) -> str:
    if url.startswith("http"):
        return url
    if url.startswith("//"):
        return "https:" + url
    return urljoin(base, url)


def get_img_from_tag(tag) -> Optional[str]:
    for attr in ("srcset", "data-srcset", "src", "data-src", "data-lazy-src", "data-original"):
        val = tag.get(attr, "")
        if val:
            parts = [p.strip().split(" ")[0] for p in val.split(",") if p.strip()]
            candidate = parts[-1] if parts else val.strip()
            if candidate:
                return candidate
    return None


def extract_image(soup: BeautifulSoup, brand: str, page_url: str) -> tuple[Optional[str], str]:
    # 1. Brand-specific CSS selectors
    for sel in BRAND_IMG_SELECTORS.get(brand, []):
        tag = soup.select_one(sel)
        if tag:
            img = get_img_from_tag(tag)
            if img:
                return abs_url(img, page_url), "ok_css"

    # 2. Open Graph / Twitter Card
    for sel in ["meta[property='og:image']", "meta[name='twitter:image']"]:
        tag = soup.select_one(sel)
        if tag and tag.get("content"):
            return abs_url(tag["content"].strip(), page_url), "ok_og"

    # 3. JSON-LD Schema.org
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data  = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                img = item.get("image")
                if isinstance(img, str) and img.startswith("http"):
                    return img, "ok_jsonld"
                if isinstance(img, list) and img:
                    return img[0], "ok_jsonld"
                for node in item.get("@graph", []):
                    img = node.get("image")
                    if isinstance(img, str) and img.startswith("http"):
                        return img, "ok_jsonld"
        except Exception:
            continue

    return None, "not_found"


def scrape_image(session: requests.Session, page_url: str, brand: str) -> tuple[Optional[str], str]:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(page_url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            return extract_image(soup, brand, page_url)
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code
            log.warning("  HTTP %s (attempt %d)", code, attempt)
            return None, f"http_{code}"
        except requests.exceptions.Timeout:
            log.warning("  Timeout (attempt %d/%d)", attempt, MAX_RETRIES)
            if attempt == MAX_RETRIES:
                return None, "timeout"
            time.sleep(MIN_DELAY)
        except Exception as exc:
            log.warning("  Error: %s", exc)
            if attempt == MAX_RETRIES:
                return None, "error"
            time.sleep(MIN_DELAY)
    return None, "error"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not INPUT_CSV.exists():
        log.error("File not found: %s", INPUT_CSV)
        return

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader     = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        rows       = list(reader)

    log.info("Loaded %d products from %s", len(rows), INPUT_CSV.name)
    session = make_session()
    report  = []
    ok = fail = 0

    for i, row in enumerate(rows, 1):
        sku      = row["sku"]
        name     = row["name"]
        brand    = row["brand"]
        old_img  = row.get("image_url", "")
        old_url  = row.get("product_url", "")

        log.info("[%d/%d] %s — %s", i, len(rows), sku, name)

        # ---- Find real product URL ----
        real_url = find_product_url(session, name, brand)
        if real_url:
            log.info("  URL found: %s", real_url)
            row["product_url"] = real_url
        else:
            log.warning("  URL not found via Google — using original")
            real_url = old_url

        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

        # ---- Scrape image ----
        new_img, status = None, "skipped_no_url"
        if real_url and real_url.startswith("http"):
            new_img, status = scrape_image(session, real_url, brand)

        if new_img:
            log.info("  ✓ Image [%s] %s", status, new_img[:90])
            row["image_url"] = new_img
            ok += 1
        else:
            log.warning("  ✗ No image [%s] — original kept", status)
            fail += 1

        report.append({
            "sku":             sku,
            "brand":           brand,
            "status":          status,
            "product_url":     real_url,
            "old_product_url": old_url,
            "old_image_url":   old_img,
            "new_image_url":   new_img,
        })

        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    # Write output CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    log.info("CSV saved → %s", OUTPUT_CSV)

    # Write report
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total":          len(rows),
                "images_updated": ok,
                "failed":         fail,
                "success_rate":   f"{ok / len(rows) * 100:.1f}%",
            },
            "details": report,
        }, f, indent=2, ensure_ascii=False)
    log.info("Report saved → %s", REPORT_JSON)
    log.info("Done — ✓ %d updated  ✗ %d failed", ok, fail)

if __name__ == "__main__":
    main()
